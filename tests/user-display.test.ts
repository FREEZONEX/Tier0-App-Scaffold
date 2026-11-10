import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { withUserDisplay } from "../src/services/user-display";
import type { AppUser } from "../src/lib/users";

function setEnv(t: TestContext, key: string, value: string) {
  const before = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (before === undefined) delete process.env[key];
    else process.env[key] = before;
  });
}

const visitor: AppUser = {
  id: "12345", username: "12345", displayName: "12345",
  roles: ["repairer", "coordinator"], primaryRole: "repairer",
};

function member(userId: string, userName = "Mercy", nickName = "") {
  return { userId, userName, nickName, status: "active", roles: [], updatedAt: "2026-11-10T00:00:00Z" };
}

for (const runtime of ["preview", "deployed"]) {
  test(`${runtime}: real SDK resolves the current name without changing visitor roles`, async (t) => {
    setEnv(t, "TIER0_RUNTIME", runtime);
    setEnv(t, "TIER0_API_HOST", "https://platform.example.test");
    setEnv(t, "TIER0_API_KEY", "test-only-placeholder");
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      assert.equal(new URL(url).pathname, "/openapi/v2/platform/getMembers");
      assert.deepEqual(JSON.parse(String(init.body)), { keyword: visitor.id, page: 1, size: 100 });
      return Response.json({ code: 200, msg: "ok", data: {
        list: [member(visitor.id, "Mercy", "平台姓名")], page: 1, size: 100, total: 1,
      } });
    });
    const result = await withUserDisplay(visitor);
    assert.deepEqual(result, { ...visitor, username: "Mercy", displayName: "平台姓名" });
    assert.equal(visitor.displayName, visitor.id);
    assert.equal(result?.roles, visitor.roles);
  });
}

test("exact ID matching handles keyword collisions and pagination", async (t) => {
  setEnv(t, "TIER0_API_HOST", "https://platform.example.test");
  setEnv(t, "TIER0_API_KEY", "test-only-placeholder");
  const pages: number[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const { page } = JSON.parse(String(init.body));
    pages.push(page);
    return Response.json({ code: 200, msg: "ok", data: {
      list: page === 1
        ? Array.from({ length: 100 }, (_, i) => member(String(i), "contains-12345"))
        : [member(visitor.id, "正确用户")],
      page, size: 100, total: 101,
    } });
  });
  assert.equal((await withUserDisplay(visitor))?.displayName, "正确用户");
  assert.deepEqual(pages, [1, 2]);
});

test("account switch, rename and role switch do not reuse a cached name", async (t) => {
  setEnv(t, "TIER0_API_HOST", "https://platform.example.test");
  setEnv(t, "TIER0_API_KEY", "test-only-placeholder");
  let name = "原姓名";
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const { keyword } = JSON.parse(String(init.body));
    return Response.json({ code: 200, msg: "ok", data: {
      list: [member(keyword, keyword === visitor.id ? name : "另一个账号")], page: 1, size: 100, total: 1,
    } });
  });
  assert.equal((await withUserDisplay(visitor))?.displayName, "原姓名");
  name = "新姓名";
  const switched = { ...visitor, roles: ["coordinator"], primaryRole: "coordinator" };
  assert.deepEqual(await withUserDisplay(switched), { ...switched, username: name, displayName: name });
  assert.equal((await withUserDisplay({ ...visitor, id: "67890" }))?.displayName, "另一个账号");
});

test("missing, blank or other members' names keep the original identity", async (t) => {
  setEnv(t, "TIER0_API_HOST", "https://platform.example.test");
  setEnv(t, "TIER0_API_KEY", "test-only-placeholder");
  let list = [member("someone-else")];
  t.mock.method(globalThis, "fetch", async () => Response.json({ code: 200, msg: "ok", data: {
    list, page: 1, size: 100, total: list.length,
  } }));
  assert.equal(await withUserDisplay(visitor), visitor);
  list = [member(visitor.id, "  ", "  ")];
  assert.equal(await withUserDisplay(visitor), visitor);
  list = [];
  assert.equal(await withUserDisplay(visitor), visitor);
});

test("upstream failure logs a sanitized message and keeps authentication intact", async (t) => {
  setEnv(t, "TIER0_API_HOST", "https://platform.example.test");
  setEnv(t, "TIER0_API_KEY", "test-only-placeholder");
  const errors = t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => new Response("sensitive upstream detail", { status: 503 }));
  assert.equal(await withUserDisplay(visitor), visitor);
  assert.deepEqual(errors.mock.calls.map((call) => call.arguments), [
    ["[user-display] Platform name unavailable; using visitor ID."],
  ]);
});

test("slow upstream aborts within the display budget and falls back", async (t) => {
  setEnv(t, "TIER0_API_HOST", "https://platform.example.test");
  setEnv(t, "TIER0_API_KEY", "test-only-placeholder");
  t.mock.method(console, "error", () => {});
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    signal = init.signal;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  });
  const started = Date.now();
  assert.equal(await withUserDisplay(visitor), visitor);
  assert.ok(signal?.aborted);
  assert.ok(Date.now() - started < 5000);
});

test("anonymous caller never triggers a member query", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected query"); });
  assert.equal(await withUserDisplay(null), null);
  assert.equal(fetch.mock.callCount(), 0);
});
