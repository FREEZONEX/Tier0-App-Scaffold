import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("route smoke contracts", () => {
  it("provides a lightweight preview route smoke script", () => {
    const scriptPath = join(process.cwd(), "scripts/route-smoke.mjs");
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );

    assert.equal(
      existsSync(scriptPath),
      true,
      "Provide scripts/route-smoke.mjs so generated apps can verify preview pages before reporting completion.",
    );

    const script = readFileSync(scriptPath, "utf8");
    assert.match(script, /export function evaluateSmokeResponse/);
    assert.match(script, /export function buildSmokePaths/);
    assert.match(script, /Page failed to load/);
    assert.match(script, /process\.exitCode = 1/);
    assert.equal(
      packageJson.scripts["smoke:routes"],
      "node --import tsx scripts/route-smoke.mjs",
    );
  });

  it("automatically includes every generated sidebar route", async () => {
    const { buildSmokePaths } = await import("../../scripts/route-smoke.mjs");

    assert.deepEqual(
      buildSmokePaths(
        ["/api/health"],
        [
          { key: "home", label: "Home", href: "/" },
          { key: "receipts", label: "Receipts", href: "/receipts" },
          { key: "inventory", label: "Inventory", href: "/inventory" },
        ],
      ),
      ["/", "/receipts", "/inventory", "/api/health"],
    );
  });

  it("treats route-level runtime failure copy as smoke failure", async () => {
    const { evaluateSmokeResponse } = await import(
      "../../scripts/route-smoke.mjs"
    );

    assert.equal(
      evaluateSmokeResponse({
        path: "/",
        status: 200,
        body: "<main>Page failed to load</main>",
      }).ok,
      false,
    );

    assert.equal(
      evaluateSmokeResponse({
        path: "/",
        status: 200,
        body: "<main>研发仓总览</main>",
      }).ok,
      true,
    );
  });

  it("keeps authoritative preview headers across redirects without an App session", async () => {
    const { smokePath } = await import("../../scripts/route-smoke.mjs");
    const calls = [];

    const fetchImpl = async (url, init) => {
      calls.push({
        url,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        redirect: init.redirect,
      });

      if (calls.length === 1) {
        return {
          status: 302,
          headers: new Headers({
            location: "http://preview.local/",
          }),
          text: async () => "",
        };
      }

      return {
        status: 200,
        headers: new Headers(),
        text: async () => "<main>R&D WMS</main>",
      };
    };

    const result = await smokePath("http://preview.local", "/", {
      fetchImpl,
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].redirect, "manual");
    assert.equal(calls[1].headers["x-tier0-runtime"], "preview");
    // No selected preview role: the platform sends no role header before
    // roles are registered, and the app must still render (zero permissions).
    assert.equal(calls[1].headers["x-tier0-preview-role"], undefined);
    assert.equal(calls[1].headers.cookie, undefined);
  });
});
