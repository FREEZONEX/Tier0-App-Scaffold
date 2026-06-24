/* eslint-disable @typescript-eslint/no-unused-vars --
 * The imports below are intentional templates for the agent to consume when
 * defining schemas. They become "used" the moment the agent adds the first table.
 */
import { pgTable, pgEnum, text, integer, boolean, timestamp, json, real } from "drizzle-orm/pg-core";
import { jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import type { Mimic } from "@/hmi/schema/schema";

// ─── Agent: define your enums and tables below ───
//
// Example enum:
//   export const orderStatus = pgEnum("order_status", ["DRAFT", "RELEASED", "IN_PROGRESS", "COMPLETED", "CLOSED"]);
//
// Example table:
//   export const workOrders = pgTable("work_orders", {
//     id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
//     code:        text("code").notNull().unique(),
//     productName: text("product_name").notNull(),
//     targetQty:   integer("target_qty").notNull(),
//     status:      orderStatus("status").default("DRAFT"),
//     notes:       text("notes"),
//     createdAt:   timestamp("created_at").defaultNow().notNull(),
//     updatedAt:   timestamp("updated_at").defaultNow().notNull().$onUpdateFn(() => new Date()),
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
// After editing: npx drizzle-kit push is useful for local pre-sync, but each
// implemented service must also runtime-bootstrap its own tables so preview
// and new tenant schemas work before any manual push/seed command runs.

export const mimics = pgTable("mimics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  data: jsonb("data").$type<Mimic>().notNull(),
  tenant: text("tenant"),
  owner: text("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const insertMimicSchema = createInsertSchema(mimics);
export const selectMimicSchema = createSelectSchema(mimics);
export type MimicRow = typeof mimics.$inferSelect;
export type NewMimicRow = typeof mimics.$inferInsert;
