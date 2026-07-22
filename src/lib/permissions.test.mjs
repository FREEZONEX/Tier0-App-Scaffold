import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("template admin role defaults", () => {
  it("keeps admin built into the permission matrix", () => {
    const permissions = readFileSync(
      join(process.cwd(), "src/lib/permissions.ts"),
      "utf8",
    );

    assert.match(permissions, /export const ADMIN_ROLE = "admin"/);
    assert.match(permissions, /\[ADMIN_ROLE\]:/);
  });

  it("keeps admin on full access to every action", () => {
    const permissions = readFileSync(
      join(process.cwd(), "src/lib/permissions.ts"),
      "utf8",
    );

    assert.match(
      permissions,
      /\[ADMIN_ROLE\]:\s*\[\s*\.\.\.ACTIONS\s*\]/,
      "Admin must keep [...ACTIONS] full access — preview fallback and the 'admin reaches everything' guarantee depend on it. Do not enumerate a subset.",
    );
  });

  it("does not ship a template role.json file", () => {
    assert.equal(
      existsSync(join(process.cwd(), "role.json")),
      false,
      "Role definitions must come from src/lib/permissions.ts and /api/manifest, not a root role.json file.",
    );
  });
});

function permissionMatrixKeys(source) {
  const block = source.match(/PERMISSION_MATRIX[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) return [];

  const keys = [];
  for (const line of block[1].split("\n")) {
    const match = line.match(
      /^\s*(?:\[ADMIN_ROLE\]|"([^"]+)"|([\p{L}\p{N}_]+))\s*:/u,
    );
    if (!match) continue;
    keys.push(match[1] ?? match[2] ?? "admin");
  }
  return keys;
}

function roleMetadataKeys(source) {
  const block = source.match(/ROLE_METADATA\s*=\s*\{([\s\S]*?)\n\}\s*as const/);
  if (!block) return [];

  const keys = [];
  for (const line of block[1].split("\n")) {
    const match = line.match(/^\s{2}(?:"([^"]+)"|([\p{L}\p{N}_]+))\s*:\s*\{/u);
    if (!match) continue;
    keys.push(match[1] ?? match[2]);
  }
  return keys;
}

describe("role definition sync", () => {
  it("parses matrix and metadata keys (self-check)", () => {
    assert.deepEqual(
      permissionMatrixKeys(
        `const PERMISSION_MATRIX: Record<string, Action[]> = {\n  [ADMIN_ROLE]: [...ACTIONS],\n  老板: [...ACTIONS],\n  test_role_a: [],\n};`,
      ),
      ["admin", "老板", "test_role_a"],
    );
    assert.deepEqual(
      roleMetadataKeys(
        `const ROLE_METADATA = {\n  admin: {\n    label: "Admin",\n  },\n  老板: {\n    label: "老板",\n  },\n} as const satisfies X;`,
      ),
      ["admin", "老板"],
    );
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

    assert.ok(matrixKeys.length >= 1, "PERMISSION_MATRIX parse produced no keys");

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

    // A matrix role absent from roles.json cannot be assigned from the
    // platform — an unreachable role. Admin is the app-internal fallback and
    // deliberately stays out of roles.json.
    const unreachableRoles = matrixKeys.filter(
      (key) => key !== "admin" && !platformKeys.includes(key),
    );
    assert.deepEqual(
      unreachableRoles,
      [],
      `PERMISSION_MATRIX roles missing from roles.json (platform cannot assign them): ${unreachableRoles.join(", ")}`,
    );
  });
});
