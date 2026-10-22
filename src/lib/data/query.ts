/**
 * Query helpers: the component kit's `QueryRequest` (MetaListPage
 * `meta/query`) → UNS filter and sort. Sort specs and `toSortPairs` come from
 * `@tier0/sdk-v2/data`.
 *
 * Pure module; it never performs I/O.
 */
import { shanghaiDateTimeToIso, shiftYmd } from "../component-kit/format";
import { resolveDynamicDate } from "../component-kit/query-model";
import type { DynamicDateValue, QueryFilter, QueryRequest } from "../component-kit/types";
import { toSortPairs, type Filter, type SortPairs } from "@tier0/sdk-v2/data";

export interface QueryConversionOptions {
  /** Stored path per `QueryFilter.field` when it differs, e.g. `{ customer: "customer.id" }`. */
  paths?: Readonly<Record<string, string>>;
  /**
   * Fields stored as ISO-8601 instants. Their "YYYY-MM-DD" range bounds are
   * widened to whole Asia/Shanghai days; other date fields compare as stored.
   */
  instantFields?: readonly string[];
  /** Upper bound for `pageSize` (default 200, the UNS page limit). */
  maxPageSize?: number;
}

export interface ConvertedQuery {
  filter: Filter;
  sort?: SortPairs;
  page: number;
  pageSize: number;
}

function refId(value: unknown): unknown {
  return typeof value === "object" && value !== null && "id" in value ? (value as { id: unknown }).id : value;
}

function dayStart(ymd: string): string | null {
  return shanghaiDateTimeToIso(ymd, "00:00:00");
}

function rangeCondition(from: unknown, to: unknown, instant: boolean): Record<string, unknown> | null {
  const condition: Record<string, unknown> = {};
  if (from !== null && from !== undefined && from !== "") {
    condition.$gte = instant && typeof from === "string" ? (dayStart(from) ?? from) : from;
  }
  if (to !== null && to !== undefined && to !== "") {
    if (instant && typeof to === "string") {
      const next = dayStart(shiftYmd(to, 1));
      if (next) condition.$lt = next;
      else condition.$lte = to;
    } else {
      condition.$lte = to;
    }
  }
  return Object.keys(condition).length > 0 ? condition : null;
}

/** One kit filter → UNS predicate, or null when it constrains nothing. */
export function filterToPredicate(filter: QueryFilter, options: QueryConversionOptions = {}): Filter | null {
  const path = options.paths?.[filter.field] ?? filter.field;
  const instant = options.instantFields?.includes(filter.field) ?? false;
  const value = filter.value;
  const list = (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]).map(refId);

  const scalar = refId(value);
  if (scalar === undefined && ["EQ", "NE", "LT", "LTE", "GT", "GTE"].includes(filter.operator)) return null;

  switch (filter.operator) {
    case "EQ":
      return { [path]: scalar };
    case "NE":
      return { [path]: { $ne: scalar } };
    case "LIKE":
      return typeof value === "string" && value ? { [path]: { $contains: value } } : null;
    case "NOT_LIKE":
      return typeof value === "string" && value ? { $nor: [{ [path]: { $contains: value } }] } : null;
    case "IN":
      return list.length ? { [path]: { $in: list } } : null;
    case "NOT_IN":
      return list.length ? { [path]: { $nin: list } } : null;
    case "LT":
      return { [path]: { $lt: value } };
    case "LTE":
      return { [path]: { $lte: value } };
    case "GT":
      return { [path]: { $gt: value } };
    case "GTE":
      return { [path]: { $gte: value } };
    case "BETWEEN": {
      const [from, to] = Array.isArray(value) ? value : [null, null];
      const condition = rangeCondition(from, to, instant);
      return condition ? { [path]: condition } : null;
    }
    case "DYNAMIC": {
      const range = value ? resolveDynamicDate(value as DynamicDateValue) : null;
      const condition = range ? rangeCondition(range[0], range[1], instant) : null;
      return condition ? { [path]: condition } : null;
    }
    case "IS_NULL":
      return { [path]: { $exists: false } };
    case "NOT_NULL":
      return { [path]: { $exists: true } };
    default:
      throw new Error(`Unsupported filter operator: ${String(filter.operator)}`);
  }
}

/**
 * Converts a kit `QueryRequest` into a UNS filter, sort and page. `scope`,
 * `viewCode` and `groupValue` are App-specific: merge their conditions into
 * `filter` in the service before querying.
 */
export function queryRequestToFind(request: QueryRequest, options: QueryConversionOptions = {}): ConvertedQuery {
  const predicates = (request.filters ?? [])
    .map((filter) => filterToPredicate(filter, options))
    .filter((predicate): predicate is Filter => predicate !== null);
  if (request.ids?.length) predicates.push({ _id: { $in: [...request.ids] } });

  const sort = toSortPairs(
    (request.sorts ?? []).map(({ field, direction }) => [options.paths?.[field] ?? field, direction === "desc" ? -1 : 1] as const),
  );
  const maxPageSize = options.maxPageSize ?? 200;
  const pageSize = Math.min(Math.max(1, Math.trunc(request.page?.pageSize ?? 20)), maxPageSize);
  const page = Math.max(1, Math.trunc(request.page?.current ?? 1));

  return {
    filter: predicates.length === 0 ? {} : predicates.length === 1 ? predicates[0] : { $and: predicates },
    ...(sort ? { sort } : {}),
    page,
    pageSize,
  };
}
