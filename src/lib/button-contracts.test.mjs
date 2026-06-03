import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const ROOTS = ["src/components", "src/routes"];

function walkFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function findButtonTagsWithoutType(source) {
  const matches = [...source.matchAll(/<button\b[\s\S]*?>/g)];
  return matches
    .filter(([tag]) => !/\btype\s*=/.test(tag))
    .map(([tag]) => tag);
}

describe("button contracts", () => {
  it("keeps every native button explicit about its type", () => {
    const offenders = [];

    for (const root of ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const source = readFileSync(file, "utf8");
        const invalidTags = findButtonTagsWithoutType(source);
        if (invalidTags.length === 0) {
          continue;
        }

        offenders.push({
          file: relative(process.cwd(), file),
          tags: invalidTags,
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Buttons missing explicit type:\n${JSON.stringify(offenders, null, 2)}`,
    );
  });
});
