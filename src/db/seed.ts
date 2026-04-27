import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const dbSchema = process.env.DB_SCHEMA;

const pool = new Pool({
  connectionString:
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  max: 5,
  ...(dbSchema ? { options: `-csearch_path=${dbSchema}` } : {}),
});
const db = drizzle(pool, { schema });

// Re-export so the example block below stays self-contained when uncommented.
void db;

async function main() {
  console.log("Seeding database...");

  // ─── Agent: add your seed data here ───
  //
  // Until you replace this block, the script throws — a no-op seed is almost
  // always a bug (you ran it, nothing happened, you assumed it worked).
  // Delete the throw once you've added at least one insert below.
  //
  // Use db.insert().values([...]).onConflictDoUpdate() for idempotency.
  // Include 5–10 records per table with interlinked references.
  //
  // Example with nullable + JSON fields:
  //
  //   await db.insert(schema.workOrders).values([
  //     {
  //       id: "wo-001",
  //       code: "WO-2024-001",
  //       productName: "Widget A",
  //       targetQty: 500,
  //       completedQty: 320,
  //       status: "IN_PROGRESS",
  //       notes: null,                                        // nullable text → null
  //       assigneeId: "user-001",                             // nullable FK → string
  //       metadata: { batchSize: 50, priority: "high" },      // json column → plain object
  //       scheduledAt: new Date("2026-03-20T08:00:00"),       // nullable timestamp → Date
  //       createdAt: new Date("2026-03-18T10:00:00"),
  //       updatedAt: new Date("2026-03-25T14:30:00"),
  //     },
  //     {
  //       id: "wo-002",
  //       code: "WO-2024-002",
  //       productName: "Widget B",
  //       targetQty: 200,
  //       status: "DRAFT",
  //       // omitted nullable fields default to column defaults (null or DB default)
  //       createdAt: new Date("2026-03-19T09:00:00"),
  //       updatedAt: new Date("2026-03-19T09:00:00"),
  //     },
  //   ]).onConflictDoUpdate({
  //     target: schema.workOrders.id,
  //     set: {
  //       productName: sql`excluded.product_name`,
  //       targetQty: sql`excluded.target_qty`,
  //       completedQty: sql`excluded.completed_qty`,
  //       status: sql`excluded.status`,
  //       notes: sql`excluded.notes`,
  //       metadata: sql`excluded.metadata`,
  //       updatedAt: sql`excluded.updated_at`,
  //     },
  //   });

  throw new Error(
    "src/db/seed.ts is unconfigured — add your insert statements and remove this throw.",
  );

  // eslint-disable-next-line no-unreachable
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => pool.end());
