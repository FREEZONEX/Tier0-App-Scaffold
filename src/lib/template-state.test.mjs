import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// TEMPLATE-STATE ASSERTIONS — the one contract file generated apps ADAPT.
//
// This file asserts the scaffold's blank-template condition. When you build a
// real application these assertions become wrong BY DESIGN: replace them with
// assertions that describe the app you actually built (its navigation modules,
// its home route), or empty the describe block if there is nothing worth
// pinning. Every other test file is a locked invariant gate — see AGENTS.md
// "Locked gates vs template-state tests" — enforced by
// scripts/gate-integrity.mjs. This file is deliberately NOT hash-pinned.

describe("template state (adapt when building the real app)", () => {
  it("does not ship Overview as a required default workspace page", () => {
    const shellModules = readFileSync(
      join(process.cwd(), "src/components/shell-modules.ts"),
      "utf8",
    );
    const permissions = readFileSync(
      join(process.cwd(), "src/lib/permissions.ts"),
      "utf8",
    );
    const blankRoute = readFileSync(
      join(process.cwd(), "src/routes/_app.index.tsx"),
      "utf8",
    );

    assert.match(
      shellModules,
      /export const defaultModules = defineNavigationModules\(\[\]\)/,
    );
    assert.doesNotMatch(shellModules, /\bOverview\b/);
    assert.doesNotMatch(shellModules, /\bview_dashboard\b/);
    assert.doesNotMatch(permissions, /\bview_dashboard\b/);
    assert.match(blankRoute, /Do not create an\s+ \* overview\/dashboard page unless/);
  });

  it("shows a branded pre-generation state only while the blank route exists", () => {
    const appLayout = readFileSync(
      join(process.cwd(), "src/routes/_app.tsx"),
      "utf8",
    );
    const placeholder = readFileSync(
      join(process.cwd(), "src/components/TemplatePreviewPlaceholder.tsx"),
      "utf8",
    );
    const styles = readFileSync(
      join(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );

    assert.match(appLayout, /<TemplatePreviewPlaceholder \/>/);
    assert.doesNotMatch(placeholder, /Preview ready/);
    assert.match(placeholder, /Start building to see your Tier0 app here\./);
    assert.match(
      styles,
      /\.template-preview-root:has\([\s\S]*\[aria-hidden="true"\][\s\S]*> \.template-preview-placeholder/,
    );
  });
});
