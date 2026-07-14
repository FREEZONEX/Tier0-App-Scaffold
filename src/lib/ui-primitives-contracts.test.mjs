import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// The ui/ primitives are the implementation of DESIGN.md's component recipes.
// They are the scaffold's visual identity: generated apps compose them instead
// of hand-rolling buttons/badges/headers, so every app inherits one look.

const UI_ROOT = "src/components/ui";

const REQUIRED_PRIMITIVES = [
  "button.tsx",
  "status-badge.tsx",
  "card.tsx",
  "page-header.tsx",
  "filter-chips.tsx",
  "risk-banner.tsx",
  "empty-state.tsx",
  "stat-card.tsx",
  "index.ts",
];

function readUiFile(name) {
  return readFileSync(join(process.cwd(), UI_ROOT, name), "utf8");
}

describe("ui primitive contracts", () => {
  it("ships every DESIGN.md-recipe primitive", () => {
    const missing = REQUIRED_PRIMITIVES.filter(
      (name) => !existsSync(join(process.cwd(), UI_ROOT, name)),
    );
    assert.deepEqual(
      missing,
      [],
      `Missing ui primitives (implementations of DESIGN.md recipes): ${missing.join(", ")}`,
    );
  });

  it("keeps the five DESIGN.md button variants", () => {
    const source = readUiFile("button.tsx");
    for (const variant of ["highlight", "primary", "secondary", "outline", "ghost"]) {
      assert.match(
        source,
        new RegExp(`\\b${variant}\\b`),
        `Button must keep the "${variant}" recipe variant`,
      );
    }
  });

  it("drives StatusBadge colors from the shared state recipes", () => {
    const source = readUiFile("status-badge.tsx");
    for (const tone of ["state-running", "state-idle", "state-paused", "state-error", "state-info"]) {
      assert.match(source, new RegExp(tone), `StatusBadge must use ${tone}`);
    }
  });

  it("keeps PageHeader on the shared type scale and off raw highlight text", () => {
    const source = readUiFile("page-header.tsx");
    assert.match(source, /typo-h3|typo-h2/, "PageHeader title uses the typo scale");
    assert.doesNotMatch(
      source,
      /text-highlight(?!-)/,
      "Eyebrow/kicker text must not use raw highlight lime; use text-accent-strong",
    );
  });

  it("keeps index.ts exporting every primitive", () => {
    const source = readUiFile("index.ts");
    for (const name of [
      "Button",
      "StatusBadge",
      "Card",
      "PageHeader",
      "StatusFilterChips",
      "RiskBanner",
      "EmptyState",
      "StatCard",
    ]) {
      assert.match(source, new RegExp(`\\b${name}\\b`), `index.ts must export ${name}`);
    }
  });
});
