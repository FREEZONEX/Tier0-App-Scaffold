import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  getGatewayRole,
  getGatewayRuntime,
  getTrustedGatewayRoles,
  parseGatewayUser,
} from "./gateway";

describe("gateway header parsing", () => {
  it("keeps ASCII legacy role headers unchanged", () => {
    const headers = new Headers({
      "X-App-User-Role": "boss",
    });

    assert.equal(getGatewayRole(headers), "boss");
  });

  it("decodes percent-encoded preview roles in preview runtime", () => {
    const headers = new Headers({
      "X-Tier0-Runtime": "preview",
      "X-Tier0-Preview-Role": "%E8%80%81%E6%9D%BF",
      "X-Tier0-Active-Role": "boss",
      "X-App-User-Role": "admin",
    });

    assert.equal(getGatewayRole(headers), "老板");
  });

  it("decodes latin-1 mojibake active roles", () => {
    const mojibakeRole = Buffer.from("老板", "utf8").toString("latin1");
    const headers = new Headers({
      "X-Tier0-Active-Role": mojibakeRole,
      "X-App-User-Role": "boss",
    });

    assert.equal(getGatewayRole(headers), "老板");
  });

  it("decodes a mojibake JSON user header back to the original unicode role", () => {
    const mojibakeUserHeader = Buffer.from(
      JSON.stringify({
        userID: "u-1",
        userName: "alice",
        role: "老板",
      }),
      "utf8",
    ).toString("latin1");
    const headers = new Headers({
      user: mojibakeUserHeader,
    });

    assert.deepEqual(parseGatewayUser(headers), {
      id: "u-1",
      name: "alice",
      email: "",
      role: "老板",
    });
  });

  it("prefers active role headers over JSON user.role", () => {
    const headers = new Headers({
      "X-Tier0-Active-Role": "boss",
      user: JSON.stringify({
        userID: "u-2",
        userName: "mercy",
        role: "operator",
      }),
    });

    assert.deepEqual(parseGatewayUser(headers), {
      id: "u-2",
      name: "mercy",
      email: "",
      role: "boss",
    });
  });

  it("distinguishes authoritative deployed and preview runtime contexts", () => {
    const previewHeaders = new Headers({
      "X-Tier0-Runtime": "preview",
    });
    const deployedHeaders = new Headers({
      "X-Tier0-Runtime": "deployed",
    });

    assert.equal(getGatewayRuntime(previewHeaders), "preview");
    assert.equal(getGatewayRuntime(deployedHeaders), "deployed");
    assert.equal(getGatewayRuntime(new Headers()), undefined);
    assert.equal(getTrustedGatewayRoles(previewHeaders), undefined);
    assert.deepEqual(getTrustedGatewayRoles(deployedHeaders), []);
  });

  it("keeps App authentication Gateway-only with no shared session secret", () => {
    const artifact = readFileSync("artifact.toml", "utf8");
    const envExample = readFileSync(".env.example", "utf8");
    const start = readFileSync("src/start.ts", "utf8");
    const auth = readFileSync("src/lib/auth.ts", "utf8");
    const vite = readFileSync("vite.config.ts", "utf8");

    assert.doesNotMatch(artifact, /^\s*SESSION_SECRET\s*=/m);
    assert.doesNotMatch(envExample, /^\s*SESSION_SECRET\s*=/m);
    assert.equal(existsSync("src/lib/session.ts"), false);
    assert.equal(existsSync("src/routes/api/auth/select-role.ts"), false);
    assert.equal(existsSync("src/routes/api/auth/logout.ts"), false);

    for (const [path, source] of [
      ["src/start.ts", start],
      ["src/lib/auth.ts", auth],
      ["vite.config.ts", vite],
    ] as const) {
      assert.doesNotMatch(source, /mes-session/iu, `${path} must not use mes-session`);
      assert.doesNotMatch(
        source,
        /(?:getCookie|setCookie|deleteCookie|encodeSession|decodeSession)/u,
        `${path} must not read or write an App session`,
      );
    }

    assert.match(start, /getTrustedGatewayRoles\(request\.headers\)/u);
    assert.match(auth, /getTrustedGatewayRoles\(headers\)/u);
    assert.match(vite, /req\.headers\["x-tier0-runtime"\]\s*\?\?=\s*"preview"/u);
    assert.match(vite, /req\.headers\["x-tier0-preview-role"\]/u);
  });
});
