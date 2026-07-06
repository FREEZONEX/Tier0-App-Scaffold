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

function findUncontainedTables(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  if (!/<table\b/.test(stripped)) {
    return [];
  }

  const hasIntentionalViewport =
    /<TableViewport\b|data-table-scroll|overflow-x-auto|overflow-auto/.test(stripped);

  return hasIntentionalViewport ? [] : ["<table>"];
}

describe("table layout contracts", () => {
  it("provides data-table primitives for dense enterprise tables", () => {
    const tableLayout = readFileSync(
      join(process.cwd(), "src/components/data/table-layout.tsx"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/components/data/index.ts"),
      "utf8",
    );

    assert.match(tableLayout, /export function TableViewport/);
    assert.match(tableLayout, /export function TableCellText/);
    assert.match(tableLayout, /export function TableStatusCell/);
    assert.match(tableLayout, /data-table-scroll/);
    assert.match(tableLayout, /overflow-x-auto/);
    assert.match(tableLayout, /align-top/);
    assert.match(tableLayout, /whitespace-nowrap/);
    assert.match(index, /TableViewport/);
    assert.match(index, /TableCellText/);
    assert.match(index, /TableStatusCell/);
  });

  it("flags generated tables without an intentional horizontal viewport", () => {
    const unsafe = `
      export function InventoryPage() {
        return <table><tbody><tr><td>RM-COCOA-LIQ</td></tr></tbody></table>;
      }
    `;
    assert.deepEqual(findUncontainedTables(unsafe), ["<table>"]);

    const safePrimitive = `
      export function InventoryPage() {
        return <TableViewport><table><tbody><tr><td>RM-COCOA-LIQ</td></tr></tbody></table></TableViewport>;
      }
    `;
    assert.deepEqual(findUncontainedTables(safePrimitive), []);

    const safeExplicit = `
      export function InventoryPage() {
        return <div className="overflow-x-auto"><table><tbody><tr><td>RM-COCOA-LIQ</td></tr></tbody></table></div>;
      }
    `;
    assert.deepEqual(findUncontainedTables(safeExplicit), []);
  });

  it("keeps generated dense tables from relying on page overflow", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const uncontainedTables = findUncontainedTables(readFileSync(file, "utf8"));
        if (uncontainedTables.length === 0) {
          continue;
        }

        offenders.push({
          file: relative(process.cwd(), file),
          tables: uncontainedTables,
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Tables must use TableViewport from @/components/data or an explicit internal overflow-x-auto wrapper:\n${JSON.stringify(offenders, null, 2)}`,
    );
  });
});
