import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LOCAL_APP_ID, resolveAppId } from "./app-id.ts";

// APP_ID contract (issue #57): a platform-owned runtime identifier with one
// resolution point and a fallback that reads as a local placeholder. The
// platform-injected value must pass through untouched; the fallback must not
// look like a real app id, and no file may still advertise the old default.

const readRepoFile = (relativePath) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("APP_ID runtime contract", () => {
  it("falls back to the local placeholder only when APP_ID is not injected", () => {
    assert.equal(LOCAL_APP_ID, "local-app");
    assert.equal(resolveAppId({}), "local-app");
    assert.equal(resolveAppId({ APP_ID: "" }), "local-app");
    assert.equal(resolveAppId({ APP_ID: "   " }), "local-app");
  });

  it("returns the platform-injected APP_ID untouched", () => {
    assert.equal(resolveAppId({ APP_ID: "session-xyz789" }), "session-xyz789");
    assert.equal(resolveAppId({ APP_ID: " session-xyz789 " }), "session-xyz789");
  });

  it("resolves the manifest app id through the single resolution point", () => {
    const manifest = readRepoFile("src/routes/api/manifest.ts");
    assert.match(manifest, /resolveAppId\(/, "/api/manifest must use resolveAppId() from src/lib/app-id.ts.");
    assert.doesNotMatch(
      manifest,
      /process\.env\.APP_ID|monoapp/,
      "/api/manifest must not read APP_ID or define a default itself; src/lib/app-id.ts owns the fallback.",
    );
  });

  it("keeps .env.example, README and the platform contract on the same default", () => {
    assert.match(readRepoFile(".env.example"), /^APP_ID=local-app$/m, ".env.example must set APP_ID=local-app.");

    for (const file of ["README.md", "docs/platform-integration.md"]) {
      const source = readRepoFile(file);
      const appIdRow = source.split("\n").find((line) => /^\|\s*`APP_ID`\s*\|/.test(line));
      assert.ok(appIdRow, `${file} must document APP_ID in its environment table.`);
      assert.match(appIdRow, /`local-app`/, `${file}: the APP_ID row must name the local-app fallback.`);
      assert.doesNotMatch(appIdRow, /monoapp/i, `${file}: APP_ID must no longer default to monoapp.`);
    }
  });

  it("keeps a single name for the identifier (no TIER0_APP_ID alias anywhere)", () => {
    const roots = ["README.md", "AGENTS.md", ".env.example", "docs", "src", "scripts"];
    const offenders = [];
    const visit = (relativePath) => {
      const fullPath = join(process.cwd(), relativePath);
      if (statSync(fullPath).isDirectory()) {
        for (const entry of readdirSync(fullPath)) visit(join(relativePath, entry));
        return;
      }
      if (relativePath.endsWith("app-id-contracts.test.mjs")) return;
      if (/TIER0_APP_ID/.test(readFileSync(fullPath, "utf8"))) offenders.push(relativePath);
    };
    for (const root of roots) visit(root);
    assert.deepEqual(offenders, [], "APP_ID is the only name for the platform App UUID; TIER0_APP_ID must not appear.");
  });

  it("states the platform ownership rule for generated apps", () => {
    const agents = readRepoFile("AGENTS.md").replace(/\s+/g, " ");
    assert.match(agents, /`APP_ID` is a platform-owned runtime identifier/, "AGENTS.md must state that APP_ID is platform-owned.");
    assert.match(agents, /`local-app`/, "AGENTS.md must name local-app as the local-development fallback.");
  });
});
