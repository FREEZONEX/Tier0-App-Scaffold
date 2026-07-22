import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { rowsOf } from "@/services/db-results";

type BootstrapTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RuntimeTableBootstrap {
  /**
   * Physical table name from schema.ts. Keep it unqualified; DB_SCHEMA is
   * applied by the runtime connection search_path and by the empty-table check.
   */
  tableName: string;
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

    if (schemaName) {
      await tx.execute(
        sql.raw(`create schema if not exists ${quoteIdentifier(schemaName)}`),
      );
    }

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
      if (table.seed && !(await hasRows(tx, schemaName, table.tableName))) {
        await table.seed(tx);
      }
    }
  });
}

async function hasRows(
  tx: BootstrapTx,
  schemaName: string | null,
  tableName: string,
) {
  const result = await tx.execute(
    sql.raw(
      `select exists (select 1 from ${tableReference(
        schemaName,
        tableName,
      )} limit 1) as has_rows`,
    ),
  );
  const [row] = rowsOf(result) as Array<{ has_rows?: unknown }>;
  return row?.has_rows === true || row?.has_rows === "true";
}

function getRuntimeSchema() {
  const schemaName = process.env.DB_SCHEMA?.trim();
  return schemaName ? schemaName : null;
}

function tableReference(schemaName: string | null, tableName: string) {
  const table = quoteIdentifier(tableName);
  return schemaName ? `${quoteIdentifier(schemaName)}.${table}` : table;
}

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${identifier}`);
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}
