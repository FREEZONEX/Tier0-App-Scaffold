import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataClient, defineCollection } from "@tier0/sdk-v2/data";
import { z } from "zod";
import { withErrors } from "../src/lib/route-handlers";
import { authBridge } from "../src/start";

// The data client itself is tested in @tier0/sdk-v2. These cases cover the
// Scaffold's wiring around it: src/start.ts opens the SDK's request context,
// and withErrors answers DataErrors with their mapped status.

const SUBJECT_HEADER = "X-Tier0-App-Data-Subject";
const ENSURE = "/uns/app/collections/ensure";
const COUNT = "/uns/collections/c-orders/records:count";

const orders = defineCollection({
  alias: "orders",
  schema: z.object({ code: z.string(), status: z.enum(["OPEN", "DONE"]) }),
  indexes: [{ path: "code", unique: true }],
});

interface Sent {
  path: string;
  headers: Record<string, string>;
}

type Reply = { status?: number; body: unknown };

/** Mock UNS: one reply per path suffix (after /openapi/v2). */
function mockUns(routes: Record<string, Reply>) {
  const sent: Sent[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.slice(url.indexOf("/openapi/v2") + "/openapi/v2".length);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    sent.push({ path, headers });
    const reply = routes[path] ?? { status: 404, body: { code: 404, msg: `no mock for ${path}`, error: { code: "NOT_FOUND" } } };
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as typeof globalThis.fetch;
  return { fetch, calls: (path: string) => sent.filter((entry) => entry.path === path) };
}

const ok = (data: unknown) => ({ body: { code: 200, msg: "ok", requestId: "req-1", data } });
const ensured = ok({
  appId: "app-1",
  results: [{ alias: "orders", collectionId: "c-orders", revision: 1, status: "unchanged", ignored: [], warnings: [], indexStatus: [] }],
});

function client(mock: ReturnType<typeof mockUns>) {
  return createDataClient({
    collections: [orders],
    fetch: mock.fetch,
    apiHost: "http://gw.local:8795",
    apiKey: "sk-app",
    environment: "preview",
    logger: { info() {}, warn() {}, error() {} },
  });
}

describe("route handlers", () => {
  it("lets withErrors answer with the mapped status and code", async () => {
    const mock = mockUns({
      [ENSURE]: ensured,
      "/uns/collections/c-orders/records": {
        status: 409,
        body: {
          code: 409,
          msg: "DUPLICATE_KEY",
          requestId: "req-err",
          data: null,
          error: {
            code: "DUPLICATE_KEY",
            reason: "DUPLICATE_KEY",
            retryable: false,
            details: [],
            retryAdvice: { recommendedAction: "inspectErrorAndCorrectRequest", canRetrySameRequest: false, keepIdempotencyKey: true },
          },
        },
      },
    });
    const data = client(mock);
    const handler = withErrors(async () => {
      await data.collection(orders).insertOne({ code: "A", status: "OPEN" });
      return Response.json({});
    });
    const response = await handler();
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, "DUPLICATE_KEY");
    assert.equal(body.requestId, "req-err");
  });
});

describe("request context", () => {
  it("opens the SDK request context in src/start.ts, so data calls carry the subject on every path", async () => {
    const mock = mockUns({ [ENSURE]: ensured, [COUNT]: ok({ count: 1 }) });
    const data = client(mock);
    await data.ensure();
    const serve = (path: string, headers: Record<string, string>) =>
      (authBridge.options.server as unknown as (context: { request: Request; pathname: string; next: () => Promise<unknown> }) => Promise<unknown>)({
        request: new Request(`http://app.local${path}`, { headers }),
        pathname: path,
        next: () => data.collection(orders).countDocuments(),
      });

    await serve("/_serverFn/abc", { [SUBJECT_HEADER]: "h.jwt-fn.s" });
    await serve("/api/orders", {
      [SUBJECT_HEADER]: "h.jwt-api.s",
      "X-App-User-ID": "u1",
      "X-Tier0-Runtime": "deployed",
      "X-Tier0-Business-Roles": "",
    });
    await serve("/_serverFn/abc", {});

    const subjects = mock.calls(COUNT).map((entry) => entry.headers[SUBJECT_HEADER.toLowerCase()]);
    assert.deepEqual(subjects, ["h.jwt-fn.s", "h.jwt-api.s", undefined]);
    assert.equal(mock.calls(ENSURE)[0].headers[SUBJECT_HEADER.toLowerCase()], undefined);
  });
});
