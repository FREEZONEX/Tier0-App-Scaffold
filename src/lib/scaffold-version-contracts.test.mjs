import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  SCAFFOLD_REF_PATTERN,
  readScaffoldVersion,
  validateScaffoldVersion,
} from "../../scripts/scaffold-version.mjs";

// Scaffold version contract: package.json.tier0Scaffold identifies which
// Tier0-App-Scaffold version an App was generated from. The platform reads it
// on import and prompts alignment when it is missing or differs from the
// current scaffold. Apps never edit it by hand; the align-platform-app skill
// writes it after a successful alignment.

const SCRIPT_PATH = "scripts/scaffold-version.mjs";
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

describe("scaffold version marker", () => {
  it("declares package.json.tier0Scaffold as an object", () => {
    const value = packageJson.tier0Scaffold;
    assert.ok(
      value && typeof value === "object" && !Array.isArray(value),
      "package.json must declare a top-level tier0Scaffold object; run `node scripts/scaffold-version.mjs --bump` on a clean tree in the scaffold repository.",
    );
  });

  it("records a positive integer version", () => {
    const version = packageJson.tier0Scaffold?.version;
    assert.ok(
      Number.isInteger(version) && version > 0,
      `tier0Scaffold.version must be a positive integer (got ${JSON.stringify(version)}).`,
    );
  });

  it("records a 7 to 40 character lowercase hex ref", () => {
    const ref = packageJson.tier0Scaffold?.ref;
    assert.equal(typeof ref, "string", "tier0Scaffold.ref must be a string.");
    assert.match(ref, /^[0-9a-f]{7,40}$/, `tier0Scaffold.ref must be a short or full git sha (got ${JSON.stringify(ref)}).`);
  });
});

describe("scaffold version script", () => {
  it("ships scripts/scaffold-version.mjs", () => {
    assert.ok(existsSync(join(process.cwd(), SCRIPT_PATH)), `${SCRIPT_PATH} must exist.`);
  });

  it("exports readScaffoldVersion and validateScaffoldVersion", () => {
    assert.equal(typeof readScaffoldVersion, "function");
    assert.equal(typeof validateScaffoldVersion, "function");
    assert.ok(SCAFFOLD_REF_PATTERN instanceof RegExp);
  });

  it("reads and accepts the committed marker", () => {
    const value = readScaffoldVersion(join(process.cwd(), "package.json"));
    assert.deepEqual(value, packageJson.tier0Scaffold);
    const { problems } = validateScaffoldVersion(value);
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("rejects missing, malformed and non-positive markers", () => {
    assert.ok(validateScaffoldVersion(undefined).problems.length > 0);
    assert.ok(validateScaffoldVersion("14").problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 0, ref: "e4f1c2a" }).problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 1.5, ref: "e4f1c2a" }).problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 1, ref: "E4F1C2A" }).problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 1, ref: "abc" }).problems.length > 0);
    assert.deepEqual(validateScaffoldVersion({ version: 14, ref: "e4f1c2a" }).problems, []);
  });
});
