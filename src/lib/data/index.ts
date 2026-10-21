/**
 * App data layer — server-only. Import it from `src/services/**` only.
 *
 *   import { data } from "@/lib/data";
 *   import { workOrders } from "@/data/collections";
 *
 *   const orders = data.collection(workOrders);
 *   const open = await orders.find({ status: "OPEN" }, { sort: { "_meta.createdAt": -1 }, limit: 50 }).toArray();
 *
 * Collections come from `src/data/collections.ts` and are ensured in one
 * batch on first access. Full rules: AGENTS.md → App Data.
 */
import { collections } from "../../data/collections";
import { createDataClient } from "./client";

export const data = createDataClient({ collections });

export { runAsApp } from "./context";
export { DataError } from "./transport";
export { filterToPredicate, queryRequestToFind, toSortPairs } from "./query";
export type { Collection, Cursor, BulkOperation, FindOptions, FindPageOptions, FindOneAndOptions, UpdateOptions, WithMeta } from "./collection";
export type { TransactResult, TransactStep } from "./client";
export type { Doc, NewDoc, RecordMeta } from "./define";
export type { ConvertedQuery, Filter, QueryConversionOptions, Sort } from "./query";
