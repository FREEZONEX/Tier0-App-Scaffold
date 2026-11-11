import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import type { SourceDefinition, CloudStreamDocument } from "@tier0/sdk-v2";
import type { Visitor } from "@tier0/sdk-v2/server";
import * as serverSdk from "@tier0/sdk-v2/server";
import { loadTier0Sdk, loadTier0Mq } from "../src/lib/tier0";

const require = createRequire(import.meta.url);

test("the lazy SDK loader resolves the exact installed Cloud contract", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const installedVersion = require("@tier0/sdk-v2/package.json").version;
  assert.equal(pkg.dependencies["@tier0/sdk-v2"], installedVersion);
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

test("both installed server entry points accept only strict employee visitors", () => {
  const cjs = require("@tier0/sdk-v2/server") as typeof serverSdk;
  const appID = "fixture-app";
  const claims = { ws: "1001", app: appID, runtime: "deployed", sub_type: "employee", sub: "42", grant: "g1", app_roles: ["reader"] };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  for (const sdk of [serverSdk, cjs]) {
    const parsed = sdk.parseVisitorHeader(encode(claims), { appID });
    assert.equal(parsed.subType, "employee");
    assert.deepEqual(parsed.appRoles, ["reader"]);
    assert.ok(Object.isFrozen(parsed));
    for (const patch of [
      { sub_type: "machine", grant: "" },
      { sub_type: "machine", grant: "g1" },
      { sub_type: "service" },
      { grant: "" },
      { app: "other-app" },
      { exp: 1 },
    ]) {
      assert.throws(() => sdk.parseVisitorHeader(encode({ ...claims, ...patch }), { appID }),
        (error: unknown) => error instanceof sdk.VisitorError && error.code === "VISITOR_HEADER_INVALID");
    }
  }
});

test("the installed SDK keeps outbound App Key authentication separate from visitor identity", async () => {
  const previous = process.env.TIER0_API_KEY;
  process.env.TIER0_API_KEY = "fixture-app-key";
  try {
    const sdk = await loadTier0Sdk();
    const sent: Headers[] = [];
    const client = sdk.createClient({
      apiHost: "https://fixture.invalid",
      fetch: (async (_input, init) => {
        sent.push(new Headers(init?.headers));
        return new Response(JSON.stringify({ code: 200, data: { name: "fixture", version: "1", capabilities: [] } }));
      }) as typeof fetch,
    });
    await client.system.info();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].get("X-API-Key"), "fixture-app-key");
    for (const name of ["Authorization", "X-Tier0-Visitor", "X-Tier0-Delegation", "X-Tier0-App-Data-Subject"]) {
      assert.equal(sent[0].get(name), null, name);
    }
  } finally {
    if (previous === undefined) delete process.env.TIER0_API_KEY;
    else process.env.TIER0_API_KEY = previous;
  }
});

// @ts-expect-error Machine visitors are not part of the installed public type.
const retiredVisitorType: Visitor["subType"] = "machine";
void retiredVisitorType;

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


test("the installed SDK exposes its nested agent guidance and domain entries", () => {
  const root = dirname(require.resolve("@tier0/sdk-v2/package.json"));
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const entry = resolve(root, "skills/tier0-sdk-v2/SKILL.md");
  assert.ok(existsSync(entry), "Builder must be able to open the installed SDK entry");
  for (const skill of pkg.agents.skills) {
    assert.ok(existsSync(resolve(root, skill.path, "SKILL.md")), skill.name);
  }
  const markdown = readFileSync(entry, "utf8");
  for (const match of markdown.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
    assert.ok(existsSync(resolve(dirname(entry), match[1]!)), `SDK entry link: ${match[1]}`);
  }
});
