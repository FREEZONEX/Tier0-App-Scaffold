import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function runContract({ count = 4, missingMetadata = false, missingRegistration = false, invalidKey = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "scaffold-role-contract-"));
  try {
    mkdirSync(join(root, "src/lib"), { recursive: true });
    for (const file of ["src/lib/permissions.test.mjs", "src/lib/auth.ts", "src/start.ts"]) {
      writeFileSync(join(root, file), readFileSync(file));
    }
    const roles = Array.from({ length: count }, (_, i) => `role_${String.fromCharCode(97 + i)}`);
    if (invalidKey) roles[0] = "role2";
    writeFileSync(join(root, "src/lib/permissions.ts"), `const PERMISSION_MATRIX = {\n${roles.map(key => `  ${key}: [],`).join("\n")}\n};`);
    writeFileSync(join(root, "src/lib/role-metadata.ts"), `const ROLE_METADATA = {\n${roles.slice(missingMetadata ? 1 : 0).map(key => `  ${key}: {\n  },`).join("\n")}\n} as const;`);
    writeFileSync(join(root, "roles.json"), JSON.stringify({ roles: roles.slice(missingRegistration ? 1 : 0).map(role_key => ({ role_key })) }));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, ["--test", "src/lib/permissions.test.mjs"], { cwd: root, encoding: "utf8", env });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("valid role models above three pass the real contract", () => {
  for (const count of [4, 8]) {
    const result = runContract({ count });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

for (const [option, message] of [
  ["missingMetadata", /Roles missing a ROLE_METADATA entry/],
  ["missingRegistration", /PERMISSION_MATRIX roles missing from roles.json/],
  ["invalidKey", /role_key must match/],
]) {
  test(`role contract still rejects ${option}`, () => {
    const result = runContract({ [option]: true });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, message);
  });
}
