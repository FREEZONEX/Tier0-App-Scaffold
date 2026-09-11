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
//
// The marker is metadata: an App that lost the field must still build, so
// this test validates the field's format only when it is present. Presence is
// enforced solely in the scaffold repository's own CI through
// `node scripts/scaffold-version.mjs --strict`.

const SCRIPT_PATH = "scripts/scaffold-version.mjs";
const PACKAGE_PATH = join(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
const marker = packageJson.tier0Scaffold;
const hasMarker = marker !== undefined && marker !== null;

describe("scaffold version marker", () => {
  it("tolerates a missing field (the build only warns; the platform prompts alignment on import)", () => {
    if (!hasMarker) {
      console.log(
        "[scaffold-version-contracts] note: package.json has no tier0Scaffold field; format checks skipped.",
      );
    }
    assert.ok(true);
  });

  it("is an object when present", { skip: !hasMarker && "tier0Scaffold absent" }, () => {
    assert.ok(
      typeof marker === "object" && !Array.isArray(marker),
      "tier0Scaffold must be an object with version and ref; run `node scripts/scaffold-version.mjs --bump` on a clean tree in the scaffold repository.",
    );
  });

  it("records a positive integer version when present", { skip: !hasMarker && "tier0Scaffold absent" }, () => {
    const version = marker?.version;
    assert.ok(
      Number.isInteger(version) && version > 0,
      `tier0Scaffold.version must be a positive integer (got ${JSON.stringify(version)}).`,
    );
  });

  it("records a 7 to 40 character lowercase hex ref when present", { skip: !hasMarker && "tier0Scaffold absent" }, () => {
    const ref = marker?.ref;
    assert.equal(typeof ref, "string", "tier0Scaffold.ref must be a string.");
    assert.match(ref, /^[0-9a-f]{7,40}$/, `tier0Scaffold.ref must be a short or full git sha (got ${JSON.stringify(ref)}).`);
  });

  it("passes the script's validator when present", { skip: !hasMarker && "tier0Scaffold absent" }, () => {
    const value = readScaffoldVersion(PACKAGE_PATH);
    assert.deepEqual(value, marker);
    const { problems } = validateScaffoldVersion(value);
    assert.deepEqual(problems, [], problems.join("\n"));
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

  it("reports missing, malformed and non-positive markers as problems", () => {
    assert.ok(validateScaffoldVersion(undefined).problems.length > 0);
    assert.ok(validateScaffoldVersion("14").problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 0, ref: "e4f1c2a" }).problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 1.5, ref: "e4f1c2a" }).problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 1, ref: "E4F1C2A" }).problems.length > 0);
    assert.ok(validateScaffoldVersion({ version: 1, ref: "abc" }).problems.length > 0);
    assert.deepEqual(validateScaffoldVersion({ version: 14, ref: "e4f1c2a" }).problems, []);
  });
});
