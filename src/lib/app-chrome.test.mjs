import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("app chrome policy", () => {
  it("keeps workspace as the primary app chrome", () => {
    const policy = readFileSync(
      join(process.cwd(), "src/lib/app-chrome.ts"),
      "utf8",
    );

    assert.match(policy, /APP_PRIMARY_CHROME: AppChrome = "workspace"/);
    assert.match(policy, /prefix: "\/station"/);
    assert.match(policy, /prefix: "\/review"/);
    assert.match(policy, /prefix: "\/monitor"/);
  });

  it("uses the centralized sidebar filter in Shell", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/Shell.tsx"),
      "utf8",
    );

    assert.match(shell, /filterSidebarModules/);
    assert.doesNotMatch(shell, /NO_SIDEBAR_ROUTE_PREFIXES/);
  });
});
