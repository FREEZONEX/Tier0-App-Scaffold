import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { integer, pgSchema, text } from "drizzle-orm/pg-core";
import { Client, type Pool } from "pg";
import type { RuntimeTableBootstrap } from "../src/services/bootstrap";

const databaseName = "scaffold_bootstrap_fixture";
const schemaName = "fixture_existing";
const missingSchema = "fixture_missing";
const retrySchema = "fixture_retry";
const admin = new Client({
  connectionString: fixtureUrl("SCAFFOLD_BOOTSTRAP_ADMIN_URL", "fixture_admin"),
});
const rwUrl = fixtureUrl("SCAFFOLD_BOOTSTRAP_RW_URL", "fixture_rw");
const rw = new Client({ connectionString: rwUrl });
const fixtureSchema = pgSchema(schemaName);
const records = fixtureSchema.table("bootstrap_records", {
  id: integer("id").primaryKey(),
  value: text("value").notNull(),
});
let bootstrapModule: typeof import("../src/services/bootstrap").bootstrapModule;
let seedCalls = 0;

function fixtureUrl(variable: string, user: string): string {
  const value = process.env[variable];
  assert.ok(value, `${variable} is required for the real PostgreSQL fixture`);
  const parsed = new URL(value);
  assert.equal(parsed.hostname, "127.0.0.1");
  assert.equal(parsed.port, "15432");
  assert.equal(parsed.pathname, `/${databaseName}`);
  assert.equal(parsed.username, user);
  return value;
}

function tableBootstrap(): Array<RuntimeTableBootstrap & { tableName: string }> {
  return [{
    table: records,
    tableName: "bootstrap_records",
    createTable: sql`create table if not exists ${records} (id integer primary key, value text not null)`,
    createIndexes: [
      sql`create index if not exists bootstrap_records_value_idx on ${records} (value)`,
    ],
    seed: async (tx) => {
      seedCalls += 1;
      await tx.insert(records).values({ id: 1, value: "fixture seed" });
    },
  }];
}

before(async () => {
  process.env.DATABASE_URL = rwUrl;
  process.env.DB_SCHEMA = schemaName;
  process.env.NODE_ENV = "test";
  await admin.connect();
  await rw.connect();
  const { rows: [privileges] } = await rw.query(`select current_database() as database,
    current_user as role, rolsuper, rolcreatedb, rolcreaterole,
    has_database_privilege(current_database(), 'CREATE') as database_create,
    has_schema_privilege($1, 'USAGE') as schema_usage,
    has_schema_privilege($1, 'CREATE') as schema_create
    from pg_roles where rolname = current_user`, [schemaName]);
  assert.equal(privileges.database, databaseName);
  assert.equal(privileges.role, "fixture_rw");
  assert.equal(privileges.rolsuper, false);
  assert.equal(privileges.rolcreatedb, false);
  assert.equal(privileges.rolcreaterole, false);
  assert.equal(privileges.database_create, false);
  assert.equal(privileges.schema_usage, true);
  assert.equal(privileges.schema_create, true);
  await admin.query(`drop schema if exists ${missingSchema} cascade`);
  await admin.query(`drop schema if exists ${retrySchema} cascade`);
  await admin.query(`drop schema ${schemaName} cascade`);
  await admin.query(`create schema ${schemaName} authorization fixture_admin`);
  await admin.query(`grant usage, create on schema ${schemaName} to fixture_rw`);
  const baseline = process.env.SCAFFOLD_BOOTSTRAP_SOURCE;
  ({ bootstrapModule } = baseline
    ? await import(pathToFileURL(baseline).href)
    : await import("../src/services/bootstrap"));
});

after(async () => {
  const pool = (globalThis as unknown as { pool?: Pool }).pool;
  await pool?.end();
  await Promise.all([admin.end(), rw.end()]);
});

test("preprovisioned schema bootstraps without database CREATE; concurrent calls seed once", async () => {
  const first = bootstrapModule("fixture-records", tableBootstrap());
  const concurrent = bootstrapModule("fixture-records", tableBootstrap());
  assert.equal(first, concurrent);
  await Promise.all([first, concurrent]);
  await bootstrapModule("fixture-records", tableBootstrap());
  assert.equal(seedCalls, 1);
  const { rows } = await rw.query(`select * from ${schemaName}.bootstrap_records`);
  assert.deepEqual(rows, [{ id: 1, value: "fixture seed" }]);
  const { rows: [index] } = await rw.query(`select count(*)::int as count from pg_indexes
    where schemaname = $1 and indexname = 'bootstrap_records_value_idx'`, [schemaName]);
  assert.equal(index.count, 1);
});

test("missing schema rejects even an empty module and does not create a schema", async () => {
  process.env.DB_SCHEMA = missingSchema;
  try {
    await assert.rejects(bootstrapModule("fixture-empty-missing", []), {
      message: /PostgreSQL schema "fixture_missing" does not exist/,
    });
    const { rows: [schema] } = await rw.query(`select exists(select 1 from pg_namespace
      where nspname = $1) as present`, [missingSchema]);
    assert.equal(schema.present, false);
  } finally {
    process.env.DB_SCHEMA = schemaName;
  }
});

test("missing-schema failure clears the cache so platform provisioning can be retried", async () => {
  process.env.DB_SCHEMA = retrySchema;
  try {
    await assert.rejects(bootstrapModule("fixture-schema-retry", []), {
      message: /PostgreSQL schema "fixture_retry" does not exist/,
    });
    await admin.query(`create schema ${retrySchema} authorization fixture_admin`);
    await admin.query(`grant usage, create on schema ${retrySchema} to fixture_rw`);
    await bootstrapModule("fixture-schema-retry", []);
  } finally {
    process.env.DB_SCHEMA = schemaName;
  }
});

test("seed database errors propagate, roll back tables, and permit a later retry", async () => {
  const failureRecords = fixtureSchema.table("bootstrap_failure_records", {
    id: integer("id").primaryKey(),
  });
  const createTable = sql`create table if not exists ${failureRecords} (id integer primary key)`;
  const failure: RuntimeTableBootstrap[] = [{
    table: failureRecords,
    createTable,
    seed: async (tx) => {
      await tx.insert(failureRecords).values([{ id: 1 }, { id: 1 }]);
    },
  }];
  await assert.rejects(bootstrapModule("fixture-seed-retry", failure), (error: unknown) => {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code === "23505";
  });
  const { rows: [table] } = await rw.query(`select to_regclass($1) as relation`, [
    `${schemaName}.bootstrap_failure_records`,
  ]);
  assert.equal(table.relation, null);
  await bootstrapModule("fixture-seed-retry", [{
    table: failureRecords,
    createTable,
    seed: async (tx) => {
      await tx.insert(failureRecords).values({ id: 2 });
    },
  }]);
  const { rows } = await rw.query(`select id from ${schemaName}.bootstrap_failure_records`);
  assert.deepEqual(rows, [{ id: 2 }]);
});

test("an unset or blank DB_SCHEMA uses the existing public schema", async () => {
  try {
    delete process.env.DB_SCHEMA;
    await bootstrapModule("fixture-public", []);
    process.env.DB_SCHEMA = "   ";
    await bootstrapModule("fixture-blank-public", []);
  } finally {
    process.env.DB_SCHEMA = schemaName;
  }
});
