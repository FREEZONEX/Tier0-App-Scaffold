import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { compileCollection, MAX_COLLECTIONS, validateDocument } from "@tier0/sdk-v2/data/define";

// App data contracts — locked gate.
//
// App data lives in Tier0 UNS collections declared in src/data/collections.ts
// and reached only through the `@tier0/sdk-v2/data` client that src/lib/data
// builds. Check 1 validates the declarations exactly as the runtime will send
// them. Checks 2–5 are static source scans that catch accidental misuse by
// generated code; they are guard rails, not a security boundary (UNS
// authorization is enforced server-side):
//
//   1. Every declaration compiles to the UNS record-schema subset, is listed
//      in `collections`, and its seed documents are valid, uniquely keyed
//      records (seeds are written once, when ensure creates the collection).
//   2. Only src/services/** uses the data client (`@/lib/data`, values from
//      `@tier0/sdk-v2/data`); src/start.ts only opens the request context.
//      Any file may import the pure declarations in
//      `@tier0/sdk-v2/data/define` and types from `@tier0/sdk-v2/data`.
//   3. No source file names UNS paths directly.
//   4. Runtime code does not name schema:replace, archive or restore: they
//      are worker operations through the tier0 MCP.
//   5. Collections (and their seeds) are declared only in
//      src/data/collections.ts.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const DATA_LAYER = "src/lib/data/";
const DECLARATIONS = "src/data/collections.ts";

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && /\.(?:tsx?|mjs|js)$/.test(entry.name) && !/\.test\.(?:tsx?|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles() {
  return walkFiles(SRC).map((file) => ({
    file,
    rel: toPosixPath(relative(ROOT, file)),
    source: stripComments(readFileSync(file, "utf8")),
  }));
}

/** Import / re-export / dynamic-import specifiers of a module; `values` skips `import type` / `export type`. */
export function importSpecifiers(source, { values = false } = {}) {
  const specifiers = [];
  for (const match of source.matchAll(/\b(?:import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g)) {
    if (!(values && match[1])) specifiers.push(match[2]);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(match[1]);
  return specifiers;
}

/**
 * Data module a specifier points at: "sdk" (`@tier0/sdk-v2/data`), "define"
 * (`@tier0/sdk-v2/data/define`), a src/lib/data module ("index", "query"),
 * or null.
 */
export function dataLayerModule(fromRel, specifier) {
  if (specifier === "@tier0/sdk-v2/data") return "sdk";
  if (specifier === "@tier0/sdk-v2/data/define") return "define";
  let target;
  if (specifier === "@/lib/data" || specifier.startsWith("@/lib/data/")) {
    target = `src/lib/data${specifier.slice("@/lib/data".length)}`;
  } else if (specifier.startsWith(".")) {
    target = toPosixPath(relative(ROOT, resolve(dirname(join(ROOT, fromRel)), specifier)));
  } else {
    return null;
  }
  target = target.replace(/\.(?:tsx?|mjs|js)$/, "");
  if (target === "src/lib/data") return "index";
  if (!target.startsWith(DATA_LAYER)) return null;
  return target.slice(DATA_LAYER.length);
}

/** Whether `fromRel` may import values from the data module `module`. */
export function dataImportAllowed(fromRel, module) {
  if (fromRel.startsWith(DATA_LAYER)) return true;
  if (module === "define") return true;
  if (fromRel === "src/start.ts") return module === "sdk";
  return fromRel.startsWith("src/services/");
}

const UNS_PATH = /\/openapi\/v2\b|["'`/]uns\/(?:collections|records|app)\b/;
const NARROWING_OPERATION = /collections\/(?:schema:replace|archive|restore)\b|appCollections(?:SchemaReplace|Archive|Restore)\b/;

function valueAt(document, path) {
  return path.split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), document);
}

async function loadDeclarations() {
  return import(pathToFileURL(join(ROOT, DECLARATIONS)).href);
}

describe("app data contracts", () => {
  it("compiles every declaration and lists it in `collections`", async () => {
    const module = await loadDeclarations();
    assert.ok(Array.isArray(module.collections), `${DECLARATIONS} must export \`collections\` (an array of defineCollection results).`);

    const problems = [];
    if (module.collections.length > MAX_COLLECTIONS) {
      problems.push(`at most ${MAX_COLLECTIONS} collections per App (listed ${module.collections.length})`);
    }
    const aliases = new Set();
    for (const definition of module.collections) {
      const key = String(definition?.alias).toLowerCase();
      if (aliases.has(key)) problems.push(`alias "${definition.alias}" is listed twice (aliases are case-insensitive)`);
      aliases.add(key);
      try {
        compileCollection(definition);
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }
    for (const [name, value] of Object.entries(module)) {
      const looksDeclared = value && typeof value === "object" && typeof value.alias === "string" && "schema" in value && Array.isArray(value.indexes);
      if (looksDeclared && !module.collections.includes(value)) {
        problems.push(`\`${name}\` (alias "${value.alias}") is declared but missing from \`collections\`, so it would never be ensured`);
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("keeps seed documents valid, identified and unique", async () => {
    const module = await loadDeclarations();
    const problems = [];
    for (const definition of module.collections ?? []) {
      if (!definition.seed) continue;
      const documents = definition.seed;
      if (!Array.isArray(documents)) {
        problems.push(`${definition.alias}: seed must be an array of documents`);
        continue;
      }
      const ids = new Set();
      documents.forEach((document, index) => {
        const label = `${definition.alias} seed[${index}]`;
        if (typeof document?._id !== "string" || !document._id) {
          problems.push(`${label}: needs a fixed string _id so other seeds can reference it`);
        } else if (ids.has(document._id)) {
          problems.push(`${label}: duplicate _id "${document._id}"`);
        } else {
          ids.add(document._id);
        }
        try {
          validateDocument(definition, document);
        } catch (error) {
          const issues = Array.isArray(error?.issues)
            ? error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")
            : String(error);
          problems.push(`${label}: ${issues}`);
        }
      });
      for (const index of compileCollection(definition).indexes.filter((spec) => spec.unique)) {
        const paths = index.paths ?? [index.path];
        const seen = new Map();
        documents.forEach((document, position) => {
          const values = paths.map((path) => valueAt(document, path));
          if (values.some((value) => value === undefined)) return;
          const key = JSON.stringify(values);
          if (seen.has(key)) {
            problems.push(`${definition.alias} seed[${position}]: duplicates seed[${seen.get(key)}] on unique index (${paths.join(", ")})`);
          } else {
            seen.set(key, position);
          }
        });
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("imports the data client only from services", () => {
    const offenders = [];
    for (const { rel, source } of sourceFiles()) {
      for (const specifier of importSpecifiers(source, { values: true })) {
        const module = dataLayerModule(rel, specifier);
        if (module !== null && !dataImportAllowed(rel, module)) offenders.push(`${rel}: imports ${specifier}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      [
        "Only src/services/** may use the data client (`@/lib/data`, values from `@tier0/sdk-v2/data`). Routes call a",
        "service; components and lib code import declarations from `@tier0/sdk-v2/data/define` and `@/data/collections`",
        "(the data client is server-only and must not reach the browser bundle).",
        ...offenders,
      ].join("\n"),
    );
  });

  it("never calls UNS directly", () => {
    const offenders = sourceFiles()
      .filter(({ source }) => UNS_PATH.test(source))
      .map(({ rel }) => rel);
    assert.deepEqual(
      offenders,
      [],
      `Use \`data.collection(...)\` from @/lib/data in a service instead of fetching Tier0 UNS paths:\n${offenders.join("\n")}`,
    );
  });

  it("never narrows, archives or restores collections from runtime code", () => {
    const offenders = sourceFiles()
      .filter(({ source }) => NARROWING_OPERATION.test(source))
      .map(({ rel }) => rel);
    assert.deepEqual(
      offenders,
      [],
      [
        "schema:replace, archive and restore are explicit worker operations through the tier0 MCP",
        "(AGENTS.md → App Data); App code must not call them:",
        ...offenders,
      ].join("\n"),
    );
  });

  it("declares collections and seeds only in src/data/collections.ts", () => {
    const offenders = [];
    for (const { rel, source } of sourceFiles()) {
      if (rel.startsWith("src/data/") || rel.startsWith(DATA_LAYER)) continue;
      if (importSpecifiers(source).some((specifier) => /(?:^|\/)seed-utils$/.test(specifier))) offenders.push(`${rel}: imports seed-utils`);
      if (/\bdefineCollection\s*\(/.test(source)) offenders.push(`${rel}: calls defineCollection()`);
    }
    assert.deepEqual(
      offenders,
      [],
      [
        "Declare every collection, and its baseline `seed`, with `defineCollection(...)` in src/data/collections.ts;",
        "seeds are written once when the collection is created. Services must not insert seed rows on startup or",
        "when a list is empty:",
        ...offenders,
      ].join("\n"),
    );
  });

  it("recognises boundary shapes", () => {
    const sample = `import { data } from "@/lib/data";\nimport type { WithMeta } from "@tier0/sdk-v2/data";\nimport { defineCollection } from "@tier0/sdk-v2/data/define";\nconst m = await import("../lib/data/query");`;
    assert.deepEqual(importSpecifiers(sample), ["@/lib/data", "@tier0/sdk-v2/data", "@tier0/sdk-v2/data/define", "../lib/data/query"]);
    assert.deepEqual(importSpecifiers(sample, { values: true }), ["@/lib/data", "@tier0/sdk-v2/data/define", "../lib/data/query"]);
    assert.equal(dataLayerModule("src/routes/api/x.ts", "@/lib/data"), "index");
    assert.equal(dataLayerModule("src/routes/api/x.ts", "../../lib/data/query"), "query");
    assert.equal(dataLayerModule("src/routes/api/x.ts", "@tier0/sdk-v2/data"), "sdk");
    assert.equal(dataLayerModule("src/routes/api/x.ts", "@tier0/sdk-v2/data/define"), "define");
    assert.equal(dataLayerModule("src/routes/api/x.ts", "@/lib/database"), null);
    assert.equal(dataImportAllowed("src/routes/api/x.ts", "index"), false);
    assert.equal(dataImportAllowed("src/components/x.tsx", "sdk"), false);
    assert.equal(dataImportAllowed("src/routes/api/x.ts", "define"), true);
    assert.equal(dataImportAllowed("src/services/orders.ts", "index"), true);
    assert.equal(dataImportAllowed("src/services/orders.ts", "sdk"), true);
    assert.equal(dataImportAllowed("src/start.ts", "sdk"), true);
    assert.equal(dataImportAllowed("src/start.ts", "index"), false);
    assert.equal(UNS_PATH.test('fetch(`${host}/openapi/v2/uns/collections/${id}/records:find`)'), true);
    assert.equal(UNS_PATH.test('requestJson("/api/orders")'), false);
    assert.equal(NARROWING_OPERATION.test('"/uns/app/collections/schema:replace"'), true);
  });
});
