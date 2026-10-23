import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { installAppRuntime } from "@tier0/sdk/runtime";
import { describeRequest, messageTopic } from "./fixtures/app-streams-browser";

test("Stream SDK uses the frozen local artifact and keeps the data SDK pin", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const archive = readFileSync("vendor/tier0-sdk-0.5.4-7f0a82e.tgz");
  assert.equal(pkg.dependencies["@tier0/sdk"], "file:vendor/tier0-sdk-0.5.4-7f0a82e.tgz");
  assert.equal(createHash("sha256").update(archive).digest("hex"),
    "63ca9a348124acaab14c2fa9319b1aed10ff22bc3419ef81daa2b95f1e77afb5");
  assert.equal(lock.packages["node_modules/@tier0/sdk"].integrity,
    `sha512-${createHash("sha512").update(archive).digest("base64")}`);
  assert.equal(pkg.dependencies["@tier0/sdk-v2"],
    "github:FREEZONEX/Tier0-sdk-v2#b9aa196e6b81a8f1c9947dc4141ea4b3a3835401");
});

test("browser Stream calls require the trusted runtime and never fall back to fetch", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const fetch = t.mock.method(globalThis, "fetch", async () => assert.fail("unexpected credential transport"));
  let dispose: (() => void) | undefined;
  try {
    await assert.rejects(describeRequest("pump.start"), { errorCode: "STREAM_REQUEST_TRANSPORT_ERROR" });
    const calls: { path: string; body: unknown }[] = [];
    const contract = {
      code: "pump.start", name: "Start", description: "", contractVersion: "v1",
      inputSchema: {}, outputSchema: {}, sideEffect: "write", idempotency: "required",
      timeoutMs: 1000, status: "active",
    };
    dispose = installAppRuntime({
      appId: "19c578a2-2027-41be-8517-bd8dc999ac2c",
      async request(path, body, options) {
        assert.ok(options.signal instanceof AbortSignal);
        calls.push({ path, body });
        return Response.json(contract);
      },
    });
    assert.deepEqual(await describeRequest("pump.start"), contract);
    assert.deepEqual(calls, [{ path: "/openapi/v1/stream-requests/pump.start/describe", body: {} }]);
    const topic = messageTopic("sdk/contract");
    assert.equal(typeof topic.publish, "function");
    assert.equal(typeof topic.subscribe, "function");
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    dispose?.();
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("the installed Stream SDK browser caller bundles without Node-only dependencies", async () => {
  const { build } = await import("vite");
  const result = await build({
    configFile: false,
    logLevel: "error",
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve("tests/fixtures/app-streams-browser.ts"), formats: ["es"] },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  assert.ok(bundle && "output" in bundle);
  const entry = bundle.output.find((item) => item.type === "chunk" && item.isEntry);
  assert.ok(entry?.type === "chunk");
  assert.deepEqual(entry.imports, []);
  assert.ok(entry.exports.includes("describeRequest"));
});
