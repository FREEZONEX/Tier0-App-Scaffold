import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

// Database schema contracts — static gate for issue #52.
//
// The platform deploys with `drizzle-kit push --force` scoped to the app's
// PostgreSQL schema (DB_SCHEMA) via `schemaFilter`. drizzle-kit discards
// declared tables outside the filter, so a bare `pgTable(...)` (schema =
// public) contributes nothing, push sees zero declared tables and DROPS every
// table in DB_SCHEMA. Tables that exist only in runtime bootstrap SQL are
// dropped the same way. These checks make both shapes unbuildable:
//
//   1. src/db/schema.ts declares everything through `appSchema` (pgSchema
//      bound to DB_SCHEMA) — never bare pgTable / pgEnum.
//   2. Table declarations live only in src/db/schema.ts, the one file
//      drizzle.config.ts points at.
//   3. drizzle.config.ts keeps the DB_SCHEMA schemaFilter.
//   4. bootstrapModule(...) takes declared table objects, not names.
//   5. `npm run db:push` goes through scripts/db-sync-guard.mjs.

const SCHEMA_PATH = "src/db/schema.ts";
const DRIZZLE_CONFIG_PATH = "drizzle.config.ts";
const BOOTSTRAP_PATH = "src/services/bootstrap.ts";
const GUARD_PATH = "scripts/db-sync-guard.mjs";

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
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
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

/** Bare drizzle table/enum factories — declarations that bypass appSchema. */
export function bareSchemaFactoryUses(source) {
  return [...stripComments(source).matchAll(/\b(pgTable|pgEnum)\s*\(/g)].map((m) => m[1]);
}

/** Any drizzle table declaration (bare or schema-bound). */
export function declaresTables(source) {
  return /\b(?:pgTable|pgSchema|[\w$]+\.table)\s*\(/.test(stripComments(source));
}

describe("database schema contracts", () => {
  const schemaSource = readFileSync(join(process.cwd(), SCHEMA_PATH), "utf8");

  it("declares one appSchema bound to DB_SCHEMA", () => {
    assert.match(
      schemaSource,
      /export const appSchema(?::\s*AppSchema)?\s*=\s*dbSchemaName\s*\?\s*pgSchema\(dbSchemaName\)/,
      "src/db/schema.ts must export `appSchema = dbSchemaName ? pgSchema(dbSchemaName) : { table: pgTable, enum: pgEnum }`.",
    );
  });

  it("never declares tables or enums with bare pgTable / pgEnum", () => {
    const offenders = bareSchemaFactoryUses(schemaSource);
    assert.deepEqual(
      offenders,
      [],
      [
        `${SCHEMA_PATH} calls ${offenders.join(", ")} directly.`,
        "A bare pgTable/pgEnum declares a `public` object; with DB_SCHEMA set, drizzle-kit's",
        "schemaFilter discards it and `push` drops every table in the app schema.",
        "Declare with `appSchema.table(...)` / `appSchema.enum(...)` instead.",
      ].join("\n"),
    );
  });

  it("keeps all table declarations in src/db/schema.ts", () => {
    const offenders = [];
    for (const file of walkFiles(join(process.cwd(), "src"))) {
      const rel = toPosixPath(relative(process.cwd(), file));
      if (rel === SCHEMA_PATH) continue;
      if (declaresTables(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    assert.deepEqual(
      offenders,
      [],
      [
        "Table declarations found outside src/db/schema.ts:",
        ...offenders,
        "drizzle.config.ts only reads src/db/schema.ts; a table declared elsewhere is invisible",
        "to `drizzle-kit push` and gets dropped from DB_SCHEMA. Move it into src/db/schema.ts.",
      ].join("\n"),
    );
  });

  it("keeps drizzle-kit scoped to DB_SCHEMA and to schema.ts", () => {
    const configSource = readFileSync(join(process.cwd(), DRIZZLE_CONFIG_PATH), "utf8");
    assert.match(configSource, /schema:\s*"\.\/src\/db\/schema\.ts"/, "drizzle.config.ts must read ./src/db/schema.ts.");
    assert.match(
      configSource,
      /schemaFilter:\s*\[\s*dbSchema\s*\]/,
      "drizzle.config.ts must keep `schemaFilter: [dbSchema]` when DB_SCHEMA is set so push never touches other apps' schemas.",
    );
  });

  it("bootstraps only declared table objects", () => {
    const bootstrapSource = readFileSync(join(process.cwd(), BOOTSTRAP_PATH), "utf8");
    assert.match(
      bootstrapSource,
      /^\s*table:\s*PgTable;/m,
      "RuntimeTableBootstrap must take `table: PgTable` (the declaration from src/db/schema.ts), not a table name string.",
    );
    assert.doesNotMatch(
      bootstrapSource,
      /^\s*tableName:\s*string/m,
      "RuntimeTableBootstrap must not accept a `tableName` string — a runtime table without a declaration is dropped by the next push.",
    );
  });

  it("routes db:push through the sync guard", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    assert.equal(existsSync(join(process.cwd(), GUARD_PATH)), true, `${GUARD_PATH} is missing.`);
    assert.match(
      pkg.scripts?.["db:push"] ?? "",
      /scripts\/db-sync-guard\.mjs/,
      "package.json `db:push` must run scripts/db-sync-guard.mjs, not raw `drizzle-kit push` (which exits 0 even when it drops tables or fails).",
    );
    for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
      assert.doesNotMatch(
        command,
        /drizzle-kit\s+push/,
        `package.json script "${name}" invokes raw \`drizzle-kit push\`; use the guard instead.`,
      );
    }
  });

  it("recognises declaration shapes", () => {
    assert.deepEqual(bareSchemaFactoryUses(`export const t = pgTable("x", {});`), ["pgTable"]);
    assert.deepEqual(bareSchemaFactoryUses(`export const t = appSchema.table("x", {});`), []);
    assert.deepEqual(bareSchemaFactoryUses(`// export const t = pgTable("x", {});`), []);
    assert.equal(declaresTables(`const s = pgSchema("ops"); export const t = s.table("x", {});`), true);
    assert.equal(declaresTables(`await tx.execute(sql\`create table if not exists x()\`);`), false);
  });
});
