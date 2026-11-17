import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Shell } from "../src/components/Shell";
import { hasAnyRole } from "../src/lib/permissions";
import { noticeReconnects } from "../src/lib/record-changes";
import { reloadVisitor, syncVisitor, useVisitor } from "../src/lib/use-visitor";
import type { AppUser } from "../src/lib/users";
import { requestJson } from "../src/lib/utils";

// The roles the server sees for this visitor; tests change them the way the
// platform does when a role is revoked or granted while the page is open.
let serverRoles: string[] = [];
const realFetch = globalThis.fetch;
const cleanups: (() => void)[] = [];
afterEach(() => {
  globalThis.fetch = realFetch;
  while (cleanups.length) cleanups.pop()!();
});

/** The workspace layout (`_app.tsx`): `beforeLoad` puts the user in route context, the Shell shows it. */
async function openPage() {
  const rootRoute = createRootRoute({ component: Outlet });
  const layout = createRoute({
    getParentRoute: () => rootRoute,
    id: "_app",
    beforeLoad: async (): Promise<{ user: AppUser }> => {
      const roles = [...serverRoles];
      return { user: { id: "u-1", username: "u-1", displayName: "王明", primaryRole: roles[0] ?? "", roles, avatarUrl: "" } };
    },
    component: function Layout() {
      const { user } = layout.useRouteContext();
      return createElement(Shell, { user }, createElement(Outlet));
    },
  });
  // A generated page: the save entry is gated on the visitor's roles.
  const page = createRoute({
    getParentRoute: () => layout,
    path: "/",
    component: function Orders() {
      const { visitor } = useVisitor();
      return createElement(Fragment, null, hasAnyRole(visitor?.roles, ["editor"]) ? createElement("button", null, "保存") : null);
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([layout.addChildren([page])]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  cleanups.push(syncVisitor(router));
  return {
    html: () => renderToString(createElement(RouterProvider, { router })),
    /** Wait for the reload `reloadVisitor()` started. */
    async settled() {
      for (let i = 0; i < 50 && (i === 0 || router.state.isLoading); i++) await new Promise((resolve) => setTimeout(resolve, 5));
    },
  };
}

/** The Shell's role line, e.g. `editor`; null when it is hidden. */
function roleLine(html: string): string | null {
  return /uppercase[^"]*" title="([^"]*)"/.exec(html)?.[1] ?? null;
}

const sse = (status = 200, type = "text/event-stream") => new Response("", { status, headers: { "Content-Type": type } });

function stubFetch(answer: (method: string) => Response) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push(`${method} ${String(input)}`);
    return answer(method);
  }) as typeof fetch;
  return calls;
}

test("a refused write after a downgrade updates the Shell's role and hides save on the same page", async () => {
  serverRoles = ["editor"];
  const page = await openPage();
  assert.equal(roleLine(page.html()), "editor");
  assert.match(page.html(), /保存/);

  serverRoles = ["viewer"];
  stubFetch(() => Response.json({ error: "Role required: editor" }, { status: 403 }));
  await assert.rejects(requestJson("/api/orders/o-1", { method: "PATCH", body: "{}" }), /HTTP 403/);
  await page.settled();

  assert.equal(roleLine(page.html()), "viewer", "the role line follows the server");
  assert.doesNotMatch(page.html(), /保存/, "the gate follows the same roles");
});

test("the change stream's reconnect after an upgrade shows save on an open read-only page", async () => {
  serverRoles = ["viewer"];
  const page = await openPage();
  assert.doesNotMatch(page.html(), /保存/);

  // The front door ends the stream when the roles change; it reconnects at once.
  const streamFetch = noticeReconnects(reloadVisitor, async () => sse());
  await streamFetch("/api/uns/subscribe");
  serverRoles = ["editor", "viewer"];
  await streamFetch("/api/uns/subscribe");
  await page.settled();

  assert.equal(roleLine(page.html()), "editor · viewer");
  assert.match(page.html(), /保存/);
});

test("only a write the App refused with 401/403 reloads the visitor", async () => {
  let reloads = 0;
  cleanups.push(syncVisitor({ invalidate: async () => { reloads += 1; } }));
  const cases: [string, number, boolean][] = [
    ["POST", 403, true], ["DELETE", 401, true], ["PUT", 403, true],
    ["GET", 403, false], ["HEAD", 401, false], ["POST", 500, false], ["POST", 404, false], ["POST", 200, false],
  ];
  for (const [method, status, reloadsVisitor] of cases) {
    reloads = 0;
    stubFetch(() => (status === 200 ? Response.json({ ok: true }) : Response.json({ error: "no" }, { status })));
    await requestJson("/api/orders", { method }).catch(() => undefined);
    assert.equal(reloads, reloadsVisitor ? 1 : 0, `${method} ${status}`);
  }
  // A platform authorization failure is the runtime's: its `resumed` reloads after reauthorization.
  reloads = 0;
  stubFetch(() => Response.json({ code: "signed_out" }, { status: 403, headers: { "x-sbx-error": "signed_out" } }));
  await assert.rejects(requestJson("/api/orders", { method: "POST" }), /HTTP 403/);
  assert.equal(reloads, 0, "POST 403 signed_out");
});

test("calls during a reload join it: beforeLoad runs once", async () => {
  let invalidations = 0;
  let finish!: () => void;
  cleanups.push(syncVisitor({ invalidate: () => { invalidations += 1; return new Promise<void>((resolve) => { finish = resolve; }); } }));
  reloadVisitor();
  reloadVisitor();
  reloadVisitor();
  assert.equal(invalidations, 1);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  reloadVisitor();
  assert.equal(invalidations, 2, "a later call starts a new reload");
  finish();
});

test("the stream's first connection and attempts the SDK refuses do not reload; each accepted reconnect does", async () => {
  let reloads = 0;
  // An OK answer that is not an event stream (a proxy's HTML page) is a failed attempt to the SDK too.
  const answers = [sse(), sse(503), sse(200, "text/html"), sse(), sse(401), new Response(null, { headers: { "Content-Type": "text/event-stream" } }), sse()];
  const streamFetch = noticeReconnects(() => { reloads += 1; }, async () => answers.shift()!);
  const seen: number[] = [];
  for (let i = 0; i < 7; i++) {
    await streamFetch("/api/uns/subscribe");
    seen.push(reloads);
  }
  assert.deepEqual(seen, [0, 0, 0, 1, 1, 1, 2]);
});
