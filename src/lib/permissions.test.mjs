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
});
