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
    assert.match(script, /Page failed to load/);
    assert.match(script, /process\.exitCode = 1/);
    assert.equal(
      packageJson.scripts["smoke:routes"],
      "node scripts/route-smoke.mjs",
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
});
