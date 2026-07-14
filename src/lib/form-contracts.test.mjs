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

const ID_ONLY_OPTION =
  /<option\b[^>]*>\s*\{\s*[\w$]+(?:\.[\w$]+)*\.id\s*\}\s*<\/option>/g;

function findIdOnlyOptions(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  return [...stripped.matchAll(ID_ONLY_OPTION)].map(([block]) =>
    block.replace(/\s+/g, " "),
  );
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

  it("provides safe form layout primitives for generated enterprise forms", () => {
    const formLayout = readFileSync(
      join(process.cwd(), "src/components/forms/form-layout.tsx"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/components/forms/index.ts"),
      "utf8",
    );

    assert.match(formLayout, /export function FieldGroup/);
    assert.match(formLayout, /export function FormGrid/);
    assert.match(formLayout, /export function LineItemSection/);
    assert.match(formLayout, /\[&>\*\]:min-w-0/);
    assert.match(index, /FieldGroup/);
    assert.match(index, /FormGrid/);
    assert.match(index, /LineItemSection/);
    // Incident guard (2026-07-13): side-by-side fields misaligned when one
    // had helper text — grid stretch pushed the shorter field's input down.
    // FormGrid cells must top-align; FieldGroup rows must pack to the top.
    assert.match(formLayout ?? readFileSync(join(process.cwd(), "src/components/forms/form-layout.tsx"), "utf8"), /items-start/);
    assert.match(formLayout ?? readFileSync(join(process.cwd(), "src/components/forms/form-layout.tsx"), "utf8"), /content-start/);
  });

  it("provides a generic record picker for object selections", () => {
    const recordSelect = readFileSync(
      join(process.cwd(), "src/components/forms/record-select.tsx"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/components/forms/index.ts"),
      "utf8",
    );

    assert.match(recordSelect, /export interface RecordSelectOption/);
    assert.match(recordSelect, /export interface RecordSelectMetaLabels/);
    assert.match(recordSelect, /export function RecordSelect/);
    assert.match(recordSelect, /quantity/);
    assert.match(recordSelect, /location/);
    assert.match(recordSelect, /date/);
    assert.match(recordSelect, /metaLabels/);
    assert.match(index, /RecordSelect/);
  });

  it("flags select options that render only a record id", () => {
    const idOnly = `<option value={batch.id}>{batch.id}</option>`;
    assert.equal(findIdOnlyOptions(idOnly).length, 1);

    const nestedId = `<option value={line.batch.id}>{line.batch.id}</option>`;
    assert.equal(findIdOnlyOptions(nestedId).length, 1);

    const labeled = `<option value={batch.id}>{batch.code} - {batch.location}</option>`;
    assert.deepEqual(findIdOnlyOptions(labeled), []);

    const formatted = `<option value={option.value}>{formatRecordOptionLabel(option)}</option>`;
    assert.deepEqual(findIdOnlyOptions(formatted), []);
  });

  it("keeps generated record options from exposing only IDs", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const idOnlyOptions = findIdOnlyOptions(readFileSync(file, "utf8"));
        if (idOnlyOptions.length === 0) {
          continue;
        }

        offenders.push({
          file: relative(process.cwd(), file),
          options: idOnlyOptions,
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Record options must show label/status/quantity context, not bare IDs - use RecordSelect from @/components/forms:\n${JSON.stringify(offenders, null, 2)}`,
    );
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
