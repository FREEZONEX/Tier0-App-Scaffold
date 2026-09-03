import { sql, type SQL } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { rowsOf } from "@/services/db-results";

type BootstrapTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RuntimeTableBootstrap {
  /**
   * The table object declared in `src/db/schema.ts` (bound to `appSchema`).
   * Passing the declaration — not a name — is what keeps runtime-created
   * tables and `drizzle-kit push` on the same table set: a table that only
   * exists in bootstrap SQL is undeclared to push and gets dropped by it.
   */
  table: PgTable;
  /**
   * Optional idempotent setup that must exist before tables are created, such
   * as extensions, enums, functions, or prerequisite schema objects.
   */
  prepare?: SQL[];
  createTable: SQL;
  createIndexes?: SQL[];
  seed?: (tx: BootstrapTx) => Promise<void>;
}

const bootstraps = new Map<string, Promise<void>>();

/**
 * Service-layer database bootstrap for preview and newly provisioned tenant
 * schemas. Call this at the start of every service entrypoint that queries a
 * module table. It is safe to call repeatedly; each module runs once per server
 * process and the SQL itself is idempotent.
 */
export function bootstrapModule(
  moduleName: string,
  tables: RuntimeTableBootstrap[],
): Promise<void> {
  const schemaName = getRuntimeSchema();
  const key = `${schemaName || "public"}:${moduleName}`;
  const existing = bootstraps.get(key);
  if (existing) return existing;

  const bootstrap = runBootstrap(key, schemaName, tables).catch((error) => {
    bootstraps.delete(key);
    throw error;
  });
  bootstraps.set(key, bootstrap);
  return bootstrap;
}

async function runBootstrap(
  lockKey: string,
  schemaName: string | null,
  tables: RuntimeTableBootstrap[],
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

    // The app schema (DB_SCHEMA) is provisioned by the platform and must exist
    // before bootstrap runs; a missing schema fails loudly here on purpose.

    for (const table of tables) {
      for (const prepareSql of table.prepare ?? []) {
        await tx.execute(prepareSql);
      }
      await tx.execute(table.createTable);
      for (const indexSql of table.createIndexes ?? []) {
        await tx.execute(indexSql);
      }
    }

    for (const table of tables) {
      if (table.seed && !(await hasRows(tx, table.table))) {
        await table.seed(tx);
      }
    }
  });
}

async function hasRows(tx: BootstrapTx, table: PgTable) {
  const result = await tx.execute(
    sql`select exists (select 1 from ${table} limit 1) as has_rows`,
  );
  const [row] = rowsOf(result) as Array<{ has_rows?: unknown }>;
  return row?.has_rows === true || row?.has_rows === "true";
}

/** Physical table name of a declaration, for bootstrap SQL and diagnostics. */
export function tableName(table: PgTable): string {
  return getTableConfig(table).name;
}

function getRuntimeSchema() {
  const schemaName = process.env.DB_SCHEMA?.trim();
  return schemaName ? schemaName : null;
}
