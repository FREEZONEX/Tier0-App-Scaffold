import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CloudSourceDocument, CloudStreamDocument } from "@tier0/sdk-v2";
import { loadTier0Sdk, loadTier0Mq } from "../src/lib/tier0";

const require = createRequire(import.meta.url);

test("the lazy SDK loader resolves the exact installed Cloud contract", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies["@tier0/sdk-v2"], "file:vendor/tier0-sdk-v2-0.9.0.tgz");
  assert.equal(require("@tier0/sdk-v2/package.json").version, "0.9.0");
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
const retiredProtocol: CloudSourceDocument["protocol"] = "http_push";
void retiredProtocol;
// @ts-expect-error Current native Stream scripts have no interpreter selector.
const retiredScript: CloudStreamDocument["script"] = { code: "module.exports = api => {};", timeoutMs: 1000, sdkVersion: "tier0-stream/v2" };
void retiredScript;
