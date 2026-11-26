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
 * Declare each collection's directoryPath from the workspace root using real
 * business names. Inspect/reuse existing directories; industrial data follows
 * the known ISA-95 equipment hierarchy. Shared data uses its common ancestor.
 * An App/module directory (e.g. MES) may follow the known factory/line scope;
 * never default to a root App container or invent missing facilities.
 *
 * Collection schemas are storage schemas: plain `z.object`, `z.string()`,
 * `z.number()` / `.int()` with optional `.min()` / `.max()`, `z.boolean()`,
 * `z.enum([...])`, `z.array(...)`, nested objects and `.optional()`. No
 * `.nullable()`, `.default()`, string formats or length limits — keep those
 * in API input schemas. `npm run build` rejects anything UNS cannot store.
 *
 * Keep collections and indexes lean: embed bounded child items/history on the
 * parent document and keep static lookups in code instead of splitting extra
 * collections. Omit `indexes` by default — declare only genuine business unique
 * keys and at most one TTL (all indexes share a 500-index workspace quota, and
 * archived collections retain their indexes; prefer natural `_id` keys where
 * suitable). The platform builds query indexes (filters, sorts, `$lookup` join
 * keys) from real traffic; do not declare them.
 */
import type { CollectionDefinition } from "@tier0/sdk-v2/data/define";

// ─── Agent: declare collections below ───
//
// import { z } from "zod";
// import { defineCollection, type Doc } from "@tier0/sdk-v2/data/define";
// import { seedTimestamp } from "./seed-utils";
//
// export const workOrders = defineCollection({
//   alias: "work_orders",
//   name: "Work orders",
//   directoryPath: ["North Plant", "Line 1", "MES"], // example only: use verified business scope
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
//   indexes: [{ path: "code", unique: true }], // optional: genuine unique keys and TTL only
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
