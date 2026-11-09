import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SourceDefinition, CloudStreamDocument } from "@tier0/sdk-v2";
import { loadTier0Sdk, loadTier0Mq } from "../src/lib/tier0";

const require = createRequire(import.meta.url);

test("the lazy SDK loader resolves the exact installed Cloud contract", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const installedVersion = require("@tier0/sdk-v2/package.json").version;
  assert.equal(pkg.dependencies["@tier0/sdk-v2"], `file:vendor/tier0-sdk-v2-${installedVersion}.tgz`);
  const sdk = await loadTier0Sdk();
  const client = sdk.createClient({ apiHost: "https://fixture.invalid" });
  assert.equal(typeof client.source.documents.get, "function");
  assert.equal(typeof client.stream.documents.validate, "function");
  assert.equal(typeof client.stream.programs.deploy, "function");
  assert.equal("list" in client.source, false);
  assert.equal("runtime" in client.stream, false);
  assert.equal("controls" in client, false);
  assert.equal("ControlError" in sdk, false);
  assert.equal("ControlResultUnknownError" in sdk, false);
  assert.equal(typeof (await loadTier0Mq()).Tier0MQClient, "function");
});

test("native Stream validation preserves the current script object without a retired selector", async () => {
  const document: CloudStreamDocument = {
    name: "scaffold-sdk-contract", model: "program", sources: [], entries: [],
    script: { code: "module.exports = api => {};", timeoutMs: 1000 },
  };
  const sent: { path: string; body: unknown }[] = [];
  const sdk = await loadTier0Sdk();
  const client = sdk.createClient({
    apiHost: "https://fixture.invalid",
    fetch: (async (input, init) => {
      sent.push({ path: new URL(String(input)).pathname, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ code: 200, msg: "", requestId: "scaffold-sdk-contract", data: { valid: true, issues: [] } }), { status: 200 });
    }) as typeof fetch,
  });
  const result = await client.stream.documents.validate({ document });
  assert.equal(result.data.valid, true);
  assert.deepEqual(sent, [{ path: "/openapi/v2/uns/streams/documents/validate", body: { document } }]);
  assert.equal("sdkVersion" in document.script, false);
});

// These assignments are compile-time contract checks, never live requests.
// @ts-expect-error The installed SDK must not recreate a retired Push protocol.
const retiredProtocol: SourceDefinition["protocol"] = "http_push";
void retiredProtocol;
// @ts-expect-error Current native Stream scripts have no interpreter selector.
const retiredScript: CloudStreamDocument["script"] = { code: "module.exports = api => {};", timeoutMs: 1000, sdkVersion: "tier0-stream/v2" };
void retiredScript;

// Exercise the actual bundled SDK through the scaffold loader, not a reimplementation.
// TIER0_RUNTIME selects the member scope whether or not TIER0_API_KEY is set (the platform
// injects both). Without a key an unknown TIER0_RUNTIME is a configuration error.
test("member pickers use draft scope before publication and preserve failures", async () => {
  const previous = { runtime: process.env.TIER0_RUNTIME, key: process.env.TIER0_API_KEY };
  const sdk = await loadTier0Sdk();
  const sent: Record<string, unknown>[] = [];
  let fail = false;
  const client = sdk.createClient({
    apiHost: "https://fixture.invalid",
    fetch: (async (_input, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(fail
        ? { code: 3003017, msg: "members unavailable" }
        : { code: 200, data: { published: 2, list: [{ userId: "fixture-user", roles: [] }], total: 1 } }),
        { status: fail ? 503 : 200 });
    }) as typeof fetch,
  });
  const setEnv = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  try {
    for (const [runtime, key, scope] of [
      ["preview", undefined, "draft"],
      ["deployed", undefined, "production"],
      ["unknown", "fixture-local-key", undefined],
      [undefined, "fixture-local-key", undefined],
    ] as const) {
      setEnv("TIER0_RUNTIME", runtime);
      setEnv("TIER0_API_KEY", key);
      const result = await client.members.listApp({ appId: "fixture-app" });
      assert.deepEqual(sent.at(-1), { appId: "fixture-app", ...(scope ? { scope } : {}) });
      assert.equal(result.published, 2);
      assert.equal(result.list.length, 1, "unpublished metadata must not suppress draft members");
    }
    setEnv("TIER0_API_KEY", undefined);
    setEnv("TIER0_RUNTIME", "unknown");
    const before = sent.length;
    await assert.rejects(client.members.listApp({ appId: "fixture-app" }),
      (error: unknown) => error instanceof TypeError && /TIER0_RUNTIME/.test(error.message));
    assert.equal(sent.length, before, "a misconfigured runtime sends nothing");
    setEnv("TIER0_RUNTIME", "preview");
    fail = true;
    await assert.rejects(client.members.listApp({ appId: "fixture-app" }),
      (error: unknown) => error instanceof sdk.ApiError && error.status === 503 && error.code === 3003017);
  } finally {
    setEnv("TIER0_RUNTIME", previous.runtime);
    setEnv("TIER0_API_KEY", previous.key);
  }
});
