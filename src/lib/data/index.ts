/**
 * App data layer — server-only. Import it from `src/services/**` only.
 *
 *   import { data } from "@/lib/data";
 *   import { workOrders } from "@/data/collections";
 *
 *   const orders = data.collection(workOrders);
 *   const open = await orders.find({ status: "OPEN" }, { sort: { "_meta.createdAt": -1 }, limit: 50 }).toArray();
 *
 * The client comes from `@tier0/sdk-v2/data`; collections come from
 * `src/data/collections.ts` and are ensured in one batch on first access.
 * Full rules: AGENTS.md → App Data.
 */
import { createDataClient } from "@tier0/sdk-v2/data";
import { collections } from "../../data/collections";

export const data = createDataClient({ collections });

export { DataError, runAsApp, toSortPairs } from "@tier0/sdk-v2/data";
export type {
  BulkOperation,
  Collection,
  Cursor,
  Doc,
  Filter,
  FindOneAndOptions,
  FindOptions,
  FindPageOptions,
  NewDoc,
  RecordMeta,
  Sort,
  TransactResult,
  TransactStep,
  UpdateOptions,
  WithMeta,
} from "@tier0/sdk-v2/data";
export { filterToPredicate, queryRequestToFind } from "./query";
export type { ConvertedQuery, QueryConversionOptions } from "./query";
