/**
 * App collections — the single source of truth for stored data.
 *
 * Every collection is declared here with `defineCollection(...)` and listed in
 * `collections`. On first data access the App ensures the whole list in one
 * batch: missing collections are created (and seeded), wider declarations
 * widen storage, and nothing is ever narrowed or dropped from here. Preview
 * and the deployed App share the same collections — never `deleteMany` to
 * "reset" a schema. Rules: AGENTS.md → App Data.
 *
 * Collection schemas are storage schemas: plain `z.object`, `z.string()`,
 * `z.number()` / `.int()` with optional `.min()` / `.max()`, `z.boolean()`,
 * `z.enum([...])`, `z.array(...)`, nested objects and `.optional()`. No
 * `.nullable()`, `.default()`, string formats or length limits — keep those
 * in API input schemas. `npm run build` rejects anything UNS cannot store.
 */
import type { CollectionDefinition } from "@/lib/data/define";

// ─── Agent: declare collections below ───
//
// import { z } from "zod";
// import { defineCollection, type Doc } from "@/lib/data/define";
// import { seedTimestamp } from "./seed-utils";
//
// export const workOrders = defineCollection({
//   alias: "work_orders",
//   description: "Production work orders",
//   schema: z.object({
//     code: z.string(),
//     productName: z.string(),
//     targetQty: z.number().int().min(1),
//     completedQty: z.number().int().min(0),
//     status: z.enum(["DRAFT", "RELEASED", "IN_PROGRESS", "COMPLETED", "CLOSED"]),
//     line: z.object({ id: z.string(), name: z.string() }),  // reference snapshot
//     notes: z.string().optional(),                          // optional = may be absent
//     scheduledAt: z.string(),                               // ISO instant from toISOString()
//   }),
//   indexes: [{ path: "code", unique: true }, { path: "status" }],
//   seed: [
//     {
//       _id: "wo-001",
//       code: "WO-2026-001",
//       productName: "Widget A",
//       targetQty: 500,
//       completedQty: 320,
//       status: "IN_PROGRESS",
//       line: { id: "line-1", name: "Line 1" },
//       scheduledAt: seedTimestamp(-1),
//     },
//   ],
// });
// export type WorkOrder = Doc<typeof workOrders>;
//
// Then list it below: `export const collections = [workOrders] as const ...`.

export const collections = [] as const satisfies readonly CollectionDefinition[];
