// Database sync guard — hard verification stage (DO NOT modify).
//
// `npm run db:push` for developers and CI (issue #52). Raw `drizzle-kit push`
// exits 0 whether it dropped tables, hit a data-loss prompt without a TTY, or
// threw — its whole run is wrapped in try/catch. This script asks drizzle-kit
// for the plan, refuses destructive statements, and owns the exit code.
//
// The platform itself deploys with raw `drizzle-kit push --force`; what keeps
// that safe is the declaration shape enforced by src/lib/db-schema-contracts
// (every table bound to appSchema, every runtime table declared), not this
// script. This script exists so a developer or CI run never silently drops a
// table either.
//
// Usage:  node --import tsx scripts/db-sync-guard.mjs [--dry-run]
// Env:    DATABASE_URL / DIRECT_DATABASE_URL, DB_SCHEMA, DB_SYNC_ALLOW_DESTRUCTIVE=1
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { pushSchema } from "drizzle-kit/api";

const dryRun = process.argv.includes("--dry-run");
const allowDestructive = process.env.DB_SYNC_ALLOW_DESTRUCTIVE === "1";
const DESTRUCTIVE = /^\s*(DROP\s+(TABLE|SCHEMA|COLUMN|TYPE)|ALTER\s+TABLE[\s\S]*\bDROP\s+COLUMN|TRUNCATE)\b/i;

function log(line) {
  console.log(`[db-sync] ${line}`);
}

function fail(...lines) {
  console.error("\n[db-sync] FAILED");
  for (const line of lines) console.error(`[db-sync]   ${line}`);
  process.exit(1);
}

async function main() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL (or DIRECT_DATABASE_URL) is not set.");
  const targetSchema = process.env.DB_SCHEMA?.trim() || "public";

  // schema.ts reads DB_SCHEMA itself; verify every table landed in it.
  const schemaModule = await import(pathToFileURL(resolve("src/db/schema.ts")).href);
  const unbound = [];
  let declared = 0;
  for (const [exportName, value] of Object.entries(schemaModule)) {
    if (!is(value, PgTable)) continue;
    declared += 1;
    const { name, schema } = getTableConfig(value);
    if ((schema ?? "public") !== targetSchema) unbound.push(`${exportName} -> "${schema ?? "public"}"."${name}"`);
  }
  if (unbound.length > 0) {
    fail(
      `${unbound.length} table(s) in src/db/schema.ts are not bound to DB_SCHEMA="${targetSchema}":`,
      ...unbound.map((entry) => `  ${entry}`),
      "drizzle-kit's schemaFilter would discard them and drop every table in the app schema.",
      "Declare tables with appSchema.table(...) from src/db/schema.ts.",
    );
  }
  log(`target schema "${targetSchema}", ${declared} declared table(s)${dryRun ? " (dry run)" : ""}`);

  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    const plan = await pushSchema(schemaModule, drizzle(pool, { schema: schemaModule }), [targetSchema]);
    const destructive = plan.statementsToExecute.filter((statement) => DESTRUCTIVE.test(statement));

    if (plan.statementsToExecute.length === 0) log("no changes detected");
    for (const statement of plan.statementsToExecute) {
      log(`${DESTRUCTIVE.test(statement) ? "!! " : "   "}${statement.replace(/\s+/g, " ").trim()}`);
    }
    for (const warning of plan.warnings ?? []) log(`warning: ${warning}`);

    if ((plan.hasDataLoss || destructive.length > 0) && !allowDestructive) {
      fail(
        `plan contains destructive statements for "${targetSchema}"; nothing was applied.`,
        "A table listed for DROP exists in the database but is not declared in src/db/schema.ts.",
        "Declare it (same physical name) or, if the drop is intended, rerun with",
        "DB_SYNC_ALLOW_DESTRUCTIVE=1 after backing the schema up.",
      );
    }

    if (dryRun) {
      log("dry run complete");
      return;
    }
    if (plan.statementsToExecute.length > 0) {
      await plan.apply();
      log("applied");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
