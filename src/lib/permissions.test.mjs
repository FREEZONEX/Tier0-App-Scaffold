import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("runs managed preview with admin role by default", () => {
    const artifact = readFileSync(join(process.cwd(), "artifact.toml"), "utf8");

    assert.match(artifact, /^PREVIEW_USER_ROLE = "admin"$/m);
  });
});
