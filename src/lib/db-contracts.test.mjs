import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const SERVICE_ROOT = "src/services";

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function findUnsafeExecuteArrayUse(source) {
  const stripped = stripComments(source);
  const offenders = [];
  const assignment =
    /\b(?:const|let|var)\s+([\w$]+)\s*=\s*await\s+[\w$.]+\.execute\s*\(/g;

  for (const match of stripped.matchAll(assignment)) {
    const variableName = match[1];
    const afterAssignment = stripped.slice(match.index);
    const directArrayUse = new RegExp(
      `\\b${variableName}\\s*(?:\\.\\s*(?:map|forEach|filter|reduce|some|every|find|length)|\\[)`,
    );

    if (directArrayUse.test(afterAssignment)) {
      offenders.push(variableName);
    }
  }

  return offenders;
}

describe("database result contracts", () => {
  it("provides a shared normalizer for db.execute results", () => {
    const helperPath = join(process.cwd(), "src/services/db-results.ts");

    assert.equal(
      existsSync(helperPath),
      true,
      "Generated services need src/services/db-results.ts so raw SQL results are normalized consistently.",
    );

    const helperSource = readFileSync(helperPath, "utf8");
    assert.match(helperSource, /export function rowsOf/);
    assert.match(helperSource, /Array\.isArray\(result\)/);
    assert.match(helperSource, /Array\.isArray\(\(result as \{ rows: unknown \}\)\.rows\)/);
  });

  it("flags direct array assumptions on db.execute results", () => {
    const unsafe = `
      const alertRows = await db.execute(sql\`select * from alerts\`);
      return alertRows.map((row) => row.id);
    `;
    const safe = `
      const result = await db.execute(sql\`select * from alerts\`);
      return rowsOf(result).map((row) => row.id);
    `;

    assert.deepEqual(findUnsafeExecuteArrayUse(unsafe), ["alertRows"]);
    assert.deepEqual(findUnsafeExecuteArrayUse(safe), []);
  });

  it("keeps service code from mapping db.execute results directly", () => {
    const offenders = [];

    for (const file of walkFiles(join(process.cwd(), SERVICE_ROOT))) {
      const rel = toPosixPath(relative(process.cwd(), file));
      const source = readFileSync(file, "utf8");
      const unsafeVars = findUnsafeExecuteArrayUse(source);

      for (const variableName of unsafeVars) {
        offenders.push(`${rel}: ${variableName}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      [
        "Do not treat db.execute()/tx.execute() results as arrays.",
        "Use rowsOf(result) from src/services/db-results.ts before map/filter/reduce/length/index access.",
        ...offenders,
      ].join("\n"),
    );
  });
});
