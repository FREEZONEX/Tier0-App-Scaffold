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

  it("does not ship a template role.json file", () => {
    assert.equal(
      existsSync(join(process.cwd(), "role.json")),
      false,
      "Role definitions must come from src/lib/permissions.ts and /api/manifest, not a root role.json file.",
    );
  });
});
