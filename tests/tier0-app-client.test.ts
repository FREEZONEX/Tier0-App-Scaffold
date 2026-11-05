import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { createDataClient, defineCollection } from "@tier0/sdk-v2/data";
import { z } from "zod";
import { getTier0AppClient } from "../src/lib/tier0";

async function withFixtureDeadline<T>(run: (signal: AbortSignal) => Promise<T>, ms = 10_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`fixture deadline exceeded after ${ms}ms`));
      controller.abort();
    }, ms);
  });
  try { return await Promise.race([Promise.resolve().then(() => run(controller.signal)), deadline]); }
  finally { clearTimeout(timer); controller.abort(); }
}
function fixtureFetch(signal: AbortSignal): typeof fetch {
  return (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
}

// Exercise the actual v2 SDK and Scaffold helper. This mock is not a deployed Gateway.
test("v2 App helpers isolate platform and file credentials and preserve data and management boundaries", async () => {
  const calls: Array<{ path: string; key?: string; authorization?: string }> = [];
  let hold: ServerResponse | undefined;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    calls.push({ path: url.pathname, key: req.headers["x-api-key"] as string | undefined, authorization: req.headers.authorization });
    req.resume();
    res.setHeader("content-type", "application/json");
    if (!req.headers["x-api-key"] || req.headers.authorization) return void res.writeHead(401).end("invalid credentials");
    if (url.pathname === "/openapi/v2/uns/sources/protocols/list" || url.pathname === "/openapi/v2/uns/streams/documents/validate") {
      res.writeHead(403);
      return void res.end(JSON.stringify({ code: 403, msg: "FORBIDDEN", requestId: "fixture", data: null,
        error: { code: "FORBIDDEN", reason: "operation is not available to App credentials", details: [], execution: "notStarted", retry: { safe: false } } }));
    }
    if (url.pathname === "/openapi/v2/auth/whoami" && req.headers["x-api-key"] === "sk-app-a") {
      hold = res; started(); return;
    }
    let data: unknown = {};
    if (url.pathname === "/openapi/v2/auth/whoami") data = { userID: 7, userName: "app-context" };
    if (url.pathname === "/openapi/v2/assets/files/url") data = { fileUrl: "https://storage.example/report" };
    if (url.pathname === "/openapi/v2/uns/app/collections/ensure") data = { appId: "fixture-app", results: [{ alias: "orders", collectionId: "c-orders", revision: 1, status: "unchanged", ignored: [], warnings: [], indexStatus: [] }] };
    if (url.pathname === "/openapi/v2/uns/collections/c-orders/records:count") data = { count: 1 };
    res.end(JSON.stringify({ code: 200, msg: "", requestId: "fixture", data }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const originalHost = process.env.TIER0_API_HOST;
  const originalKey = process.env.TIER0_API_KEY;
  const host = `http://127.0.0.1:${address.port}`;
  try {
    await withFixtureDeadline(async signal => {
      process.env.TIER0_API_HOST = host;
      process.env.TIER0_API_KEY = "sk-app-a";
      const a = await getTier0AppClient();
      signal.throwIfAborted();
      const first = a.system.whoami({ signal });
      void first.catch(() => {});
      await Promise.race([waiting, first.then(() => { throw new Error("first whoami completed before the fixture held it"); })]);
      signal.throwIfAborted();
      process.env.TIER0_API_KEY = "sk-app-b";
      const b = await getTier0AppClient();
      signal.throwIfAborted();
      const orders = defineCollection({ alias: "orders", name: "Orders", directoryPath: ["Fixture"], schema: z.object({ code: z.string() }) });
      const data = createDataClient({ collections: [orders], apiHost: host, apiKey: "sk-app-b", environment: "preview", logger: { info() {}, warn() {}, error() {} },
        fetch: fixtureFetch(signal) });
      const document = { name: "fixture", model: "program" as const, sources: [], entries: [], script: { code: "module.exports = api => {};", timeoutMs: 1000 } };
      const [file, , , count] = await Promise.all([
        b.files.url({ filePath: "report.pdf" }, { signal }),
        assert.rejects(b.source.protocols.list({}, { signal }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"),
        assert.rejects(b.stream.documents.validate({ document }, { signal }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"),
        data.collection(orders).countDocuments(),
      ]);
      signal.throwIfAborted();
      assert.equal(file.fileUrl, "https://storage.example/report");
      assert.equal(count.count, 1);
      assert(hold); hold.end(JSON.stringify({ code: 200, msg: "", data: { userID: 7, userName: "app-context-a" } }));
      assert.equal((await first).userName, "app-context-a");
      assert.deepEqual(calls.map(({ path, key, authorization }) => [path, key, authorization ?? null]).sort(), [
        ["/openapi/v2/auth/whoami", "sk-app-a", null],
        ["/openapi/v2/assets/files/url", "sk-app-b", null],
        ["/openapi/v2/uns/sources/protocols/list", "sk-app-b", null],
        ["/openapi/v2/uns/streams/documents/validate", "sk-app-b", null],
        ["/openapi/v2/uns/app/collections/ensure", "sk-app-b", null],
        ["/openapi/v2/uns/collections/c-orders/records:count", "sk-app-b", null],
      ].sort());
    });
  } finally {
    if (hold && !hold.writableEnded) hold.destroy();
    if (originalHost === undefined) delete process.env.TIER0_API_HOST; else process.env.TIER0_API_HOST = originalHost;
    if (originalKey === undefined) delete process.env.TIER0_API_KEY; else process.env.TIER0_API_KEY = originalKey;
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
});

test("fixture deadline cancels actual SDK and Data requests when the server never responds", async () => {
  let received = 0;
  let closedCount = 0;
  let closed!: () => void;
  const connectionClosed = new Promise<void>(resolve => { closed = resolve; });
  const server = createServer((req, res) => {
    received++;
    req.resume();
    res.once("close", () => { if (++closedCount === 2) closed(); });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const originalHost = process.env.TIER0_API_HOST;
  const originalKey = process.env.TIER0_API_KEY;
  let usedSignal: AbortSignal | undefined;
  let pending: Promise<unknown>[] = [];
  try {
    const host = `http://127.0.0.1:${address.port}`;
    process.env.TIER0_API_HOST = host; process.env.TIER0_API_KEY = "sk-app-a";
    const client = await getTier0AppClient();
    await assert.rejects(withFixtureDeadline(async signal => {
      usedSignal = signal;
      const data = createDataClient({ apiHost: host, apiKey: "sk-app-a", fetch: fixtureFetch(signal) });
      pending = [client.system.whoami({ signal }), data.collection({ collectionId: "orders" }).countDocuments()];
      await Promise.all(pending);
    }, 1500), /fixture deadline exceeded/);
    assert.equal(received, 2);
    assert.equal(usedSignal?.aborted, true);
    await withFixtureDeadline(async () => connectionClosed, 3000);
    const settled = await withFixtureDeadline(async () => Promise.allSettled(pending), 3000);
    assert.deepEqual(settled.map(result => result.status), ["rejected", "rejected"]);
  } finally {
    if (originalHost === undefined) delete process.env.TIER0_API_HOST; else process.env.TIER0_API_HOST = originalHost;
    if (originalKey === undefined) delete process.env.TIER0_API_KEY; else process.env.TIER0_API_KEY = originalKey;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("fixture deadline settles even if a fetch implementation ignores cancellation", async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(withFixtureDeadline(async current => {
    signal = current;
    return new Promise<never>(() => {});
  }, 30), /fixture deadline exceeded/);
  assert.equal(signal?.aborted, true);
});

test("an absent injected App key fails closed", async () => {
  const original = process.env.TIER0_API_KEY;
  try { delete process.env.TIER0_API_KEY; await assert.rejects(getTier0AppClient(), /platform-injected TIER0_API_KEY/); }
  finally { if (original !== undefined) process.env.TIER0_API_KEY = original; }
});

test("captures App host and key together before asynchronous SDK loading", async () => {
  const calls: Array<{ workspace: string; key?: string }> = [];
  const servers = ["a", "b"].map(workspace => createServer((req, res) => {
    calls.push({ workspace, key: req.headers["x-api-key"] as string | undefined });
    req.resume();
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ code: 200, msg: "", requestId: "fixture", data: { userName: workspace } }));
  }));
  const originalHost = process.env.TIER0_API_HOST;
  const originalKey = process.env.TIER0_API_KEY;
  try {
    for (const server of servers) { server.listen(0, "127.0.0.1"); await once(server, "listening"); }
    const hosts = servers.map(server => {
      const address = server.address(); assert(address && typeof address !== "string");
      return `http://127.0.0.1:${address.port}`;
    });
    await withFixtureDeadline(async signal => {
      process.env.TIER0_API_HOST = hosts[0]; process.env.TIER0_API_KEY = "sk-app-a";
      const first = getTier0AppClient();
      process.env.TIER0_API_HOST = hosts[1]; process.env.TIER0_API_KEY = "sk-app-b";
      const second = getTier0AppClient();
      const [a, b] = await Promise.all([first, second]);
      signal.throwIfAborted();
      const results = await Promise.all([a.system.whoami({ signal }), b.system.whoami({ signal })]);
      signal.throwIfAborted();
      assert.deepEqual(results.map(result => result.userName), ["a", "b"]);
      assert.deepEqual(calls.sort((x, y) => x.workspace.localeCompare(y.workspace)), [
        { workspace: "a", key: "sk-app-a" },
        { workspace: "b", key: "sk-app-b" },
      ]);
    });
  } finally {
    if (originalHost === undefined) delete process.env.TIER0_API_HOST; else process.env.TIER0_API_HOST = originalHost;
    if (originalKey === undefined) delete process.env.TIER0_API_KEY; else process.env.TIER0_API_KEY = originalKey;
    for (const server of servers) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});

test("an absent injected App host fails before a later environment change", async () => {
  const originalHost = process.env.TIER0_API_HOST;
  const originalKey = process.env.TIER0_API_KEY;
  try {
    delete process.env.TIER0_API_HOST; process.env.TIER0_API_KEY = "sk-app-a";
    const client = getTier0AppClient();
    process.env.TIER0_API_HOST = "http://127.0.0.1:1";
    await assert.rejects(client, /platform-injected TIER0_API_HOST/);
  } finally {
    if (originalHost === undefined) delete process.env.TIER0_API_HOST; else process.env.TIER0_API_HOST = originalHost;
    if (originalKey === undefined) delete process.env.TIER0_API_KEY; else process.env.TIER0_API_KEY = originalKey;
  }
});
