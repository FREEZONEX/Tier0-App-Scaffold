import { strict as assert } from "node:assert";
import { createServer, type ServerResponse } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { configureClient } from "@tier0/sdk/openapi";
import { getTier0AppClient, getTier0UnsApi, getTier0AppFiles } from "../src/lib/tier0";

test("App SDK helpers keep their App keys across interleaved real HTTP calls", async () => {
  const calls: Array<{ path: string; auth?: string }> = [];
  let pending: ServerResponse | undefined;
  let initStarted!: () => void;
  const initSeen = new Promise<void>((resolve) => { initStarted = resolve; });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    calls.push({ path, auth: req.headers.authorization });
    req.resume();
    res.setHeader("content-type", "application/json");
    if (path.endsWith("/multipart/init")) {
      pending = res;
      initStarted();
    } else if (path.endsWith("/multipart/part-urls")) {
      res.end(JSON.stringify({ partUrls: [{ partNumber: 1, url: `${origin}/object` }] }));
    } else if (path === "/object") {
      res.setHeader("etag", "part-etag");
      res.end();
    } else if (path.endsWith("/multipart/complete")) {
      res.end(JSON.stringify({ filePath: "workspace-a/file" }));
    } else if (path.endsWith("/files/url")) {
      res.end(JSON.stringify({ fileUrl: `${origin}/object` }));
    } else {
      res.end(JSON.stringify({ ok: true }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const previousHost = process.env.TIER0_API_HOST;
  const previousKey = process.env.TIER0_API_KEY;
  try {
    process.env.TIER0_API_HOST = origin;
    process.env.TIER0_API_KEY = "app-workspace-a";
    const a = await getTier0AppClient();
    const upload = a.files.uploadFile(new File(["data"], "data.txt"), { multipart: {} });
    await initSeen;
    process.env.TIER0_API_KEY = "app-workspace-b";
    const b = await getTier0AppClient();
    const boundUns = await getTier0UnsApi();
    const boundFiles = await getTier0AppFiles();
    configureClient({ apiHost: origin, apiKey: "unrelated-global-key" });
    await Promise.all([
      a.systemApi.openapiv1authwhoami(),
      b.systemApi.openapiv1authwhoami(),
      boundUns.openapiv1unsbrowse({}),
      boundFiles.getFileUrl({ filePath: "workspace-b/file" }),
    ]);
    assert(pending);
    pending.end(JSON.stringify({ fileKey: "workspace-a/file", filePath: "workspace-a/file", uploadId: "upload-a" }));
    await upload;
    const api = calls.filter((call) => call.path !== "/object");
    assert.equal(api.filter((call) => call.auth === "Bearer app-workspace-a").length, 4);
    assert.equal(api.filter((call) => call.auth === "Bearer app-workspace-b").length, 3);
    assert.equal(api.some((call) => call.auth === "Bearer unrelated-global-key"), false);
    assert.equal(calls.find((call) => call.path === "/object")?.auth, undefined);
  } finally {
    if (previousHost === undefined) delete process.env.TIER0_API_HOST; else process.env.TIER0_API_HOST = previousHost;
    if (previousKey === undefined) delete process.env.TIER0_API_KEY; else process.env.TIER0_API_KEY = previousKey;
    configureClient({});
    server.close();
    await once(server, "close");
  }
});

test("App client fails closed when the App key is missing", async () => {
  const oldKey = process.env.TIER0_API_KEY;
  try {
    delete process.env.TIER0_API_KEY;
    await assert.rejects(getTier0AppClient(), /platform-injected TIER0_API_KEY/);
  } finally {
    if (oldKey !== undefined) process.env.TIER0_API_KEY = oldKey;
  }
});
