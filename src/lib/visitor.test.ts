import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { authBridge } from "../start";
import { isPublicServerFn } from "./server-fn-policy";
import { readVisitor, visitorRoles } from "./visitor";
import { WEBHOOK_PATHS } from "./webhooks";

const APP = "0b9f4b1e-6d0a-4c6b-9f53-2f6d7a1c8e01";
/** The visitor header contract's test vector. */
const VECTOR = "eyJ3cyI6IjEwMDEiLCJhcHAiOiIwYjlmNGIxZS02ZDBhLTRjNmItOWY1My0yZjZkN2ExYzhlMDEiLCJydW50aW1lIjoiZGVwbG95ZWQiLCJzdWJfdHlwZSI6ImVtcGxveWVlIiwic3ViIjoiNDIiLCJncmFudCI6ImctMSIsImFwcF9yb2xlcyI6WyJtYW5hZ2VyIl19";

function visitor(claims: Record<string, unknown> = {}) {
  const value = {
    ws: "1001", app: APP, runtime: "deployed", sub_type: "employee", sub: "u1", grant: "g1",
    app_roles: ["receiver"], active_role: "receiver", ...claims,
  };
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const headers = (value?: string) => new Headers(value ? { "X-Tier0-Visitor": value } : {});

async function serve(path: string, requestHeaders: Headers, method = "GET") {
  let passed = false;
  const result = await (authBridge.options.server as unknown as (context: unknown) => Promise<unknown>)({
    request: new Request(`http://app.local${path}`, { headers: requestHeaders, method }),
    pathname: path,
    next: async () => { passed = true; return undefined; },
  });
  return { passed, status: (result as Response | undefined)?.status };
}

describe("visitor header middleware", () => {
  before(() => {
    process.env.TIER0_APP_ID = APP;
  });
  after(() => {
    delete process.env.TIER0_APP_ID;
  });

  it("reads the contract test vector", () => {
    assert.deepEqual(readVisitor(headers(VECTOR)), {
      subType: "employee", subject: "42", grant: "g-1", workspaceID: "1001", appID: APP, runtime: "deployed", appRoles: ["manager"],
    });
  });

  it("reads the visitor and its roles from the header", () => {
    const current = readVisitor(headers(visitor({ app_roles: ["a", "b"], active_role: "b" })));
    assert.equal(current?.subject, "u1");
    assert.deepEqual(current && visitorRoles(current), ["b", "a"]);
  });

  it("answers 401 without a header, with a malformed one and with one for another App", async () => {
    const signedLooking = `${visitor()}.${visitor()}.signature`;
    for (const value of [undefined, "garbage", signedLooking, visitor({ app: "11111111-2222-4333-8444-555555555555" }), visitor({ exp: 1 })]) {
      const result = await serve("/orders", headers(value));
      assert.deepEqual(result, { passed: false, status: 401 });
    }
  });

  it("ignores plain identity headers", async () => {
    const result = await serve("/orders", new Headers({
      "X-App-User-ID": "root", user: '{"userID":"root"}', "X-Tier0-Runtime": "deployed", "X-Tier0-Business-Roles": "admin",
    }));
    assert.deepEqual(result, { passed: false, status: 401 });
  });

  it("lets an employee through", async () => {
    assert.equal((await serve("/orders", headers(visitor()))).passed, true);
  });

  it("keeps a machine visitor out of everything but declared webhooks", async () => {
    const machine = visitor({ sub_type: "machine", sub: "t0w_abc", grant: "", app_roles: [], active_role: undefined });
    assert.deepEqual(await serve("/api/orders", headers(machine)), { passed: false, status: 403 });
    assert.equal(WEBHOOK_PATHS.length, 0);
  });

  it("leaves health and build assets public", async () => {
    for (const path of ["/api/health", "/api/manifest", "/_build/app.js"]) {
      assert.equal((await serve(path, headers())).passed, true, path);
    }
  });

  it("still blocks cross-origin writes", async () => {
    const result = await serve("/api/orders", new Headers({ origin: "https://evil.example", "X-Tier0-Visitor": visitor() }), "POST");
    assert.deepEqual(result, { passed: false, status: 403 });
  });

  it("answers 503, not 401, without TIER0_APP_ID", async () => {
    delete process.env.TIER0_APP_ID;
    try {
      assert.deepEqual(await serve("/orders", headers(visitor())), { passed: false, status: 503 });
    } finally {
      process.env.TIER0_APP_ID = APP;
    }
  });
});

describe("development front door", () => {
  it("sets the visitor header from vite.config.ts under vite dev only", () => {
    const config = readFileSync("vite.config.ts", "utf8");
    assert.match(config, /apply: "serve"/u);
    assert.match(config, /x-tier0-visitor/u);
    const walk = (path: string): string[] => statSync(path).isDirectory()
      ? readdirSync(path).flatMap((name) => walk(join(path, name)))
      : [path];
    for (const path of walk("src")) {
      if (path.endsWith(".test.ts")) continue;
      assert.doesNotMatch(readFileSync(path, "utf8"), /headers\[["']x-tier0-visitor["']\]\s*=/iu, path);
    }
  });
});

describe("identity contract", () => {
  const sources = () => {
    const walk = (path: string): string[] => statSync(path).isDirectory()
      ? readdirSync(path).flatMap((name) => walk(join(path, name)))
      : [path];
    return walk("src").filter((path) => /\.tsx?$/.test(path) && !path.endsWith(".test.ts") && !path.endsWith("routeTree.gen.ts"));
  };

  it("reads no plain identity header and keeps no App session", () => {
    assert.equal(existsSync("src/lib/gateway.ts"), false);
    assert.equal(existsSync("src/lib/session.ts"), false);
    for (const path of sources()) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /X-App-User|X-Tier0-(?:Business-Roles|Active-Role|Preview-Role|Runtime)/iu, path);
      assert.doesNotMatch(source, /(?:getCookie|setCookie|deleteCookie)/u, path);
    }
  });

  it("recognises only the explicit public server function name", () => {
    assert.equal(isPublicServerFn("publicServerFnCurrentUser"), true);
    for (const name of ["publicServerFn", "loadOrders", "publicOrders", "xpublicServerFnA"]) {
      assert.equal(isPublicServerFn(name), false, name);
    }
  });

  it("allows a public server function only for reading the visitor itself", () => {
    for (const path of sources()) {
      for (const match of readFileSync(path, "utf8").matchAll(/const (\w+) = createServerFn\([^)]*\)/gu)) {
        if (isPublicServerFn(match[1])) assert.equal(match[1], "publicServerFnCurrentUser", path);
      }
    }
  });

  it("mirrors [[webhooks]] of artifact.toml in WEBHOOK_PATHS", () => {
    const declared = [...readFileSync("artifact.toml", "utf8").matchAll(/^\[\[webhooks\]\]\s*\npath\s*=\s*"([^"]+)"/gmu)].map((match) => match[1]);
    assert.deepEqual([...WEBHOOK_PATHS].sort(), declared.sort());
  });

  it("forbids reading the App credential token file from App code", () => {
    for (const path of sources()) {
      assert.doesNotMatch(readFileSync(path, "utf8"), /TIER0_CREDENTIALS_FILE|run\/tier0\/credentials/u, path);
    }
  });
});
