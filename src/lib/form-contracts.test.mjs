import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const UI_ROOTS = ["src/components", "src/routes"];

function walkFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findBareRequiredStarSpans(source) {
  return [...source.matchAll(/<span\b[^>]*>\s*(?:\{\s*["']\*["']\s*\}|\*)\s*<\/span>/g)]
    .map(([block]) => block)
    .filter((block) => {
      return !/data-required-marker=/.test(block) && !/\b(required-mark|field-required-mark)\b/.test(block);
    });
}

describe("form contracts", () => {
  it("provides a centralized required field marker", () => {
    const fieldLabel = readFileSync(
      join(process.cwd(), "src/components/forms/field-label.tsx"),
      "utf8",
    );
    const globals = readFileSync(
      join(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );

    assert.match(fieldLabel, /export function FieldLabel/);
    assert.match(fieldLabel, /export function RequiredMark/);
    assert.match(fieldLabel, /data-required-marker="true"/);
    assert.match(globals, /\[data-required-marker="true"\]/);
    assert.match(globals, /color: var\(--destructive\) !important/);
  });

  it("keeps generated UI from hand-writing required asterisks", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const source = readFileSync(file, "utf8");
        const rawMarkers = findBareRequiredStarSpans(source);
        if (rawMarkers.length === 0) {
          continue;
        }

        offenders.push({
          file: relative(process.cwd(), file),
          markers: rawMarkers,
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Use FieldLabel, RequiredMark, or data-required-marker for required asterisks:\n${JSON.stringify(offenders, null, 2)}`,
    );
  });
});
