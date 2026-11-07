import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { authBridge } from "../start";
import { createDevSigner } from "./dev-signer";
import { isPublicServerFn } from "./server-fn-policy";
import { readVisitor, visitorReady, visitorRoles } from "./visitor";
import { WEBHOOK_PATHS } from "./webhooks";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function token(claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: "EdDSA", kid: "k1" })}.${encode({
    iss: "tier0-frontdoor", aud: "app:app_1", typ: "visitor", sub_type: "employee", sub: "u1", grant: "g1", ws: "42",
    runtime: "deployed", app_roles: ["receiver"], active_role: "receiver", iat: now, exp: now + 60, jti: "j1", ...claims,
  })}`;
  return `${body}.${sign(null, Buffer.from(body), privateKey).toString("base64url")}`;
}

const jwks = (key = publicKey, kid = "k1") => JSON.stringify({ keys: [{ ...key.export({ format: "jwk" }), kid }] });

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

describe("visitor token middleware", () => {
  let dir: string;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "scaffold-jwks-"));
    writeFileSync(join(dir, "tier0-frontdoor.json"), jwks());
    process.env.TIER0_JWKS_DIR = dir;
    process.env.TIER0_APP_ID = "app_1";
  });
  after(() => {
    delete process.env.TIER0_JWKS_DIR;
    delete process.env.TIER0_APP_ID;
    rmSync(dir, { recursive: true, force: true });
  });

  it("verifies the token and reads roles from it", () => {
    const visitor = readVisitor(headers(token({ app_roles: ["a", "b"], active_role: "b" })));
    assert.equal(visitor?.subject, "u1");
    assert.deepEqual(visitor && visitorRoles(visitor), ["b", "a"]);
  });

  it("answers 401 without a token, with a forged one and with one for another App", async () => {
    const forged = generateKeyPairSync("ed25519");
    const body = token().split(".").slice(0, 2).join(".");
    const bad = `${body}.${sign(null, Buffer.from(body), forged.privateKey).toString("base64url")}`;
    for (const value of [undefined, "garbage", bad, token({ aud: "app:other" })]) {
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
    assert.equal((await serve("/orders", headers(token()))).passed, true);
  });

  it("keeps a machine visitor out of everything but declared webhooks", async () => {
    const machine = token({ sub_type: "machine", grant: undefined, app_roles: [], active_role: undefined });
    assert.deepEqual(await serve("/api/orders", headers(machine)), { passed: false, status: 403 });
    assert.equal(WEBHOOK_PATHS.length, 0);
  });

  it("leaves health and build assets public", async () => {
    for (const path of ["/api/health", "/api/manifest", "/_build/app.js"]) {
      assert.equal((await serve(path, headers())).passed, true, path);
    }
  });

  it("still blocks cross-origin writes", async () => {
    const result = await serve("/api/orders", new Headers({ origin: "https://evil.example", "X-Tier0-Visitor": token() }), "POST");
    assert.deepEqual(result, { passed: false, status: 403 });
  });

  it("answers 503, not 401, when no keys are configured", async () => {
    const saved = process.env.TIER0_JWKS_DIR;
    delete process.env.TIER0_JWKS_DIR;
    try {
      assert.deepEqual(await serve("/orders", headers(token())), { passed: false, status: 503 });
    } finally {
      process.env.TIER0_JWKS_DIR = saved;
    }
  });
});

describe("visitor token middleware with the front door's public JWKS (TIER0_JWKS_URL)", () => {
  let server: Server;
  let base: string;
  let dir: string;
  const requests: string[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const other = generateKeyPairSync("ed25519");

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "scaffold-jwks-"));
    writeFileSync(join(dir, "tier0-frontdoor.json"), jwks());
    server = createServer((request, response) => {
      requests.push(request.url ?? "");
      const send = (status: number, body: string) => response.writeHead(status, { "Content-Type": "application/json" }).end(body);
      if (request.url === "/held/jwks.json") void held.then(() => send(200, jwks()));
      else if (request.url === "/failing/jwks.json") send(500, "{}");
      else if (request.url === "/other/jwks.json") send(200, jwks(other.publicKey));
      else send(200, jwks());
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.TIER0_APP_ID = "app_1";
  });
  after(() => {
    delete process.env.TIER0_JWKS_DIR;
    delete process.env.TIER0_JWKS_URL;
    delete process.env.TIER0_APP_ID;
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const use = (config: { dir?: string; url?: string }) => {
    if (config.dir) process.env.TIER0_JWKS_DIR = config.dir;
    else delete process.env.TIER0_JWKS_DIR;
    if (config.url) process.env.TIER0_JWKS_URL = `${base}${config.url}`;
    else delete process.env.TIER0_JWKS_URL;
  };

  it("holds the first request until the keys have been fetched, then verifies against them", async () => {
    use({ url: "/held/jwks.json" });
    let settled = false;
    const pending = serve("/orders", headers(token())).finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(settled, false);
    // Before the fetch lands a token is neither verified nor taken for an anonymous caller.
    assert.throws(() => readVisitor(headers(token())), /CONFIGURATION/);
    release();
    assert.deepEqual(await pending, { passed: true, status: undefined });
    assert.equal(readVisitor(headers(token()))?.subject, "u1");
    assert.equal(readVisitor(headers(token({ aud: "app:other" }))), null);
  });

  it("does not wait forever when the fetch fails: the request is refused", async () => {
    use({ url: "/failing/jwks.json" });
    assert.deepEqual(await serve("/orders", headers(token())), { passed: false, status: 401 });
  });

  it("prefers an existing TIER0_JWKS_DIR and fetches nothing", async () => {
    requests.length = 0;
    use({ dir, url: "/other/jwks.json" });
    await visitorReady();
    assert.equal(readVisitor(headers(token()))?.subject, "u1");
    assert.deepEqual(requests, []);
  });

  it("falls back to the URL when TIER0_JWKS_DIR does not exist", async () => {
    use({ dir: join(dir, "missing"), url: "/other/jwks.json" });
    await visitorReady();
    assert.equal(readVisitor(headers(token())), null);
    const key = other.privateKey;
    const body = token().split(".").slice(0, 2).join(".");
    assert.equal(readVisitor(headers(`${body}.${sign(null, Buffer.from(body), key).toString("base64url")}`))?.subject, "u1");
  });

  it("answers 503 with neither TIER0_JWKS_DIR nor TIER0_JWKS_URL", async () => {
    use({});
    assert.deepEqual(await serve("/orders", headers(token())), { passed: false, status: 503 });
  });
});

describe("development signer", () => {
  it("generates a new key at every start", () => {
    assert.notDeepEqual(createDevSigner().jwks, createDevSigner().jwks);
  });

  it("is not accepted without the development build", () => {
    const token = createDevSigner().sign({ id: "dev", roles: [], appId: "app_1" });
    (globalThis as Record<symbol, unknown>)[Symbol.for("tier0.scaffold.dev-signer-jwks")] = createDevSigner().jwks;
    try {
      assert.throws(() => readVisitor(headers(token)), /CONFIGURATION/);
    } finally {
      delete (globalThis as Record<symbol, unknown>)[Symbol.for("tier0.scaffold.dev-signer-jwks")];
    }
  });

  it("is reachable from vite.config.ts only", () => {
    const walk = (path: string): string[] => statSync(path).isDirectory()
      ? readdirSync(path).flatMap((name) => walk(join(path, name)))
      : [path];
    for (const path of walk("src")) {
      if (path.endsWith("dev-signer.ts") || path.endsWith(".test.ts")) continue;
      assert.doesNotMatch(readFileSync(path, "utf8"), /from ["'][^"']*dev-signer/u, path);
    }
    assert.match(readFileSync("vite.config.ts", "utf8"), /apply: "serve"/u);
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
