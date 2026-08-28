/* eslint-disable @typescript-eslint/no-unused-vars --
 * The imports below are intentional templates for the agent to consume when
 * defining schemas. They become "used" the moment the agent adds the first table.
 */
import { pgEnum, pgSchema, pgTable, text, integer, boolean, timestamp, json, real, type PgSchema } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";

/**
 * The application schema. Every table and enum is declared through it.
 *
 * The platform runs each app inside its own PostgreSQL schema (`DB_SCHEMA`)
 * and deploys with `drizzle-kit push --force` scoped to that schema via
 * `schemaFilter` in `drizzle.config.ts`. drizzle-kit only diffs tables whose
 * declared schema is inside the filter: a bare `pgTable(...)` (schema
 * `public`) is discarded, push then sees zero declared tables and drops every
 * existing table in `DB_SCHEMA`. Binding declarations to `appSchema` makes
 * local (`public`), preview and deployed environments share one definition.
 * Only `appSchema` may be used to declare tables — never `pgTable` / `pgEnum`
 * directly; `src/lib/db-schema-contracts.test.mjs` enforces it.
 */
type AppSchema = Pick<PgSchema<string>, "table" | "enum">;
const dbSchemaName = process.env.DB_SCHEMA?.trim();
export const appSchema: AppSchema = dbSchemaName
  ? pgSchema(dbSchemaName)
  : // drizzle-kit rejects pgSchema("public"); locally the plain factories are the public schema.
    ({ table: pgTable, enum: pgEnum } as unknown as AppSchema);

/**
 * Standard audit columns. Spread `...timestamps` into every table so
 * `created_at` / `updated_at` always exist — then sorting or filtering by them
 * is safe in any service (`order by created_at desc` is the sensible default
 * for "newest first"). Do not order by a column a table might not have.
 */
export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
};

// ─── Agent: define your enums and tables below ───
//
// Declare everything with `appSchema.table(...)` / `appSchema.enum(...)` in
// this file only. Services bootstrap tables by passing these declared objects
// to `bootstrapModule(...)`, so a runtime table can never exist without its
// declaration.
//
// Example enum:
//   export const orderStatus = appSchema.enum("order_status", ["DRAFT", "RELEASED", "IN_PROGRESS", "COMPLETED", "CLOSED"]);
//
// Example table:
//   export const workOrders = appSchema.table("work_orders", {
//     id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
//     code:        text("code").notNull().unique(),
//     productName: text("product_name").notNull(),
//     targetQty:   integer("target_qty").notNull(),
//     status:      orderStatus("status").default("DRAFT"),
//     notes:       text("notes"),
//     ...timestamps,   // every table gets created_at / updated_at
//   });
//
// Zod schemas (derive from table — do NOT hand-write):
//   export const insertWorkOrderSchema = createInsertSchema(workOrders);
//   export const selectWorkOrderSchema = createSelectSchema(workOrders);
//   export const updateWorkOrderSchema = createUpdateSchema(workOrders);
//
// Types (infer from table — do NOT hand-write):
//   export type WorkOrder        = typeof workOrders.$inferSelect;
//   export type NewWorkOrder     = typeof workOrders.$inferInsert;
//
// After editing: `npm run db:push` syncs the target schema and refuses
// destructive statements unless DB_SYNC_ALLOW_DESTRUCTIVE=1. Each implemented
// service must also runtime-bootstrap its own tables so preview and new
// tenant schemas work before any push/seed command runs.
