import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// Role contracts (issue #55): the scaffold reserves no role names and grants
// nothing implicitly. Every role — "admin" included, if the business defines
// one — is an ordinary business role that must travel the full chain:
// PERMISSION_MATRIX -> ROLE_METADATA -> roles.json -> platform registration.

describe("no preset or reserved roles", () => {
  it("reserves no built-in role and no implicit grant", () => {
    for (const file of ["src/lib/permissions.ts", "src/lib/auth.ts", "src/start.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      assert.doesNotMatch(
        source,
        /ADMIN_ROLE/,
        `${file} reintroduces a reserved built-in role. The scaffold must not reserve role names or grant a fallback role — define business roles in PERMISSION_MATRIX and register them via roles.json.`,
      );
    }
  });

  it("does not ship a template role.json file", () => {
    assert.equal(
      existsSync(join(process.cwd(), "role.json")),
      false,
      "Role definitions must come from src/lib/permissions.ts and roles.json, not a root role.json file.",
    );
  });
});

function permissionMatrixKeys(source) {
  const block = source.match(/PERMISSION_MATRIX[^=]*=\s*\{([\s\S]*?)\n?\};/);
  if (!block) return null;

  const keys = [];
  for (const line of block[1].split("\n")) {
    const match = line.match(/^\s*(?:"([^"]+)"|([\p{L}\p{N}_]+))\s*:/u);
    if (!match) continue;
    keys.push(match[1] ?? match[2]);
  }
  return keys;
}

function roleMetadataKeys(source) {
  const block = source.match(/ROLE_METADATA\s*=\s*\{([\s\S]*?)\n?\}\s*as const/);
  if (!block) return null;

  const keys = [];
  for (const line of block[1].split("\n")) {
    const match = line.match(/^\s{2}(?:"([^"]+)"|([\p{L}\p{N}_]+))\s*:\s*\{/u);
    if (!match) continue;
    keys.push(match[1] ?? match[2]);
  }
  return keys;
}

const MAX_EFFECTIVE_APP_ROLES = 3;

describe("role definition sync", () => {
  it("parses matrix and metadata keys (self-check)", () => {
    assert.deepEqual(
      permissionMatrixKeys(
        `const PERMISSION_MATRIX: Record<string, Action[]> = {\n  老板: [...ACTIONS],\n  test_role_a: [],\n};`,
      ),
      ["老板", "test_role_a"],
    );
    assert.deepEqual(
      permissionMatrixKeys(`const PERMISSION_MATRIX: Record<string, Action[]> = {\n};`),
      [],
    );
    assert.deepEqual(
      roleMetadataKeys(
        `const ROLE_METADATA = {\n  老板: {\n    label: "老板",\n  },\n} as const satisfies X;`,
      ),
      ["老板"],
    );
    assert.deepEqual(roleMetadataKeys(`const ROLE_METADATA = {\n} as const satisfies X;`), []);
  });

  it("keeps PERMISSION_MATRIX, ROLE_METADATA, and roles.json in sync", () => {
    const matrixKeys = permissionMatrixKeys(
      readFileSync(join(process.cwd(), "src/lib/permissions.ts"), "utf8"),
    );
    const metadataKeys = roleMetadataKeys(
      readFileSync(join(process.cwd(), "src/lib/role-metadata.ts"), "utf8"),
    );
    const rolesJson = JSON.parse(
      readFileSync(join(process.cwd(), "roles.json"), "utf8"),
    );
    const platformKeys = rolesJson.roles.map((role) => role.role_key);

    assert.ok(matrixKeys !== null, "PERMISSION_MATRIX block not found in permissions.ts");
    assert.ok(metadataKeys !== null, "ROLE_METADATA block not found in role-metadata.ts");

    // Every matrix role needs metadata (label/defaultRoute); the silent
    // getRoleMetadata fallback otherwise hides the omission.
    const missingMetadata = matrixKeys.filter(
      (key) => !metadataKeys.includes(key),
    );
    assert.deepEqual(
      missingMetadata,
      [],
      `Roles missing a ROLE_METADATA entry: ${missingMetadata.join(", ")}`,
    );

    // A roles.json role absent from PERMISSION_MATRIX is NOT a build failure.
    // The gateway injects it as an authoritative Tier0 runtime role, so it
    // ENTERS the app and resolves to zero permissions via can() until the
    // permission plane defines it — see docs/role-registration.md
    // ("Zero permissions is entry, not access") and src/start.ts. The platform
    // also *regenerates* roles.json from its DB on export, so such roles appear
    // with no source edit at all; hard-failing here would break deploys for a
    // state the runtime deliberately supports. Surface it as a non-blocking
    // advisory instead so the drift is still visible without gating the build.
    const rolesAwaitingPermissions = platformKeys.filter(
      (key) => !matrixKeys.includes(key),
    );
    if (rolesAwaitingPermissions.length > 0) {
      console.warn(
        `[role-sync] roles.json roles not yet in PERMISSION_MATRIX (enter with zero permissions): ${rolesAwaitingPermissions.join(", ")}`,
      );
    }

    // A matrix role absent from roles.json is unreachable: the platform can
    // only assign registered roles. No role is exempt from registration.
    const unreachableRoles = matrixKeys.filter(
      (key) => !platformKeys.includes(key),
    );
    assert.deepEqual(
      unreachableRoles,
      [],
      `PERMISSION_MATRIX roles missing from roles.json (platform cannot assign them; register every role, no exceptions): ${unreachableRoles.join(", ")}`,
    );
  });

  it("keeps the first-version role model to at most three business roles", () => {
    const matrixKeys = permissionMatrixKeys(
      readFileSync(join(process.cwd(), "src/lib/permissions.ts"), "utf8"),
    );
    const metadataKeys = roleMetadataKeys(
      readFileSync(join(process.cwd(), "src/lib/role-metadata.ts"), "utf8"),
    );

    assert.ok(
      matrixKeys.length <= MAX_EFFECTIVE_APP_ROLES,
      `Keep at most ${MAX_EFFECTIVE_APP_ROLES} roles, chosen for materially different permission scopes. Current matrix: ${matrixKeys.join(", ")}`,
    );
    assert.ok(
      metadataKeys.length <= MAX_EFFECTIVE_APP_ROLES,
      `ROLE_METADATA exceeds the ${MAX_EFFECTIVE_APP_ROLES}-role first-version limit: ${metadataKeys.join(", ")}`,
    );
  });

  it("role_key values satisfy the platform key format", () => {
    // Platform-side SyncAppRoles validates ^[a-z]+(_[a-z]+)*$ (lowercase
    // letters + single underscores; digits/hyphens/uppercase rejected).
    // A non-conforming key deploys fine locally but the platform refuses to
    // register it — and refuses the whole roles.json on import. Catch it here.
    const PLATFORM_ROLE_KEY = /^[a-z]+(?:_[a-z]+)*$/u;
    const rolesJson = JSON.parse(
      readFileSync(join(process.cwd(), "roles.json"), "utf8"),
    );
    const badKeys = rolesJson.roles
      .map((role) => role.role_key ?? role.key ?? "")
      .filter((key) => !PLATFORM_ROLE_KEY.test(key));
    assert.deepEqual(
      badKeys,
      [],
      `role_key must match ^[a-z]+(_[a-z]+)*$ (platform rejects them otherwise): ${badKeys.join(", ")}`,
    );
  });
});
