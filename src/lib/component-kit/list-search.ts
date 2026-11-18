/**
 * Client-side list search model behind two separate components:
 *
 * - 关键词搜索（多字段模糊搜索 · KeywordSearch）: one keyword, matched
 *   case-insensitively as a substring against several business-configured
 *   fields; a row matches when ANY configured field contains it.
 * - 高级筛选（多条件组合筛选 · AdvancedFilter）: one control per field; the
 *   filled conditions combine with AND, empty conditions are ignored.
 *
 * When a list enables both, a row must match the keyword AND every filled
 * condition (`filterListRows`). Pure module — no React, safe for tests/server.
 */
import { isEmptyValue, isRefValue } from "@/lib/component-kit/format";
import {
  buildQueryFilters,
  resolveDynamicDate,
  searchControlKind,
  type SearchValues,
} from "@/lib/component-kit/query-model";
import type { DynamicDateValue, FieldDef, QueryFilter } from "@/lib/component-kit/types";

/* ------------------------------------------------------------------ */
/* 关键词搜索 · multi-field fuzzy match                                  */
/* ------------------------------------------------------------------ */

/** One field the keyword is matched against; the business decides the list. */
export interface KeywordField<Row> {
  /** Row property read when `value` is not given. */
  key: string;
  /** Shown in the search box placeholder, e.g. 「编号」. */
  label: string;
  /** Custom read (nested data, child rows, display text). */
  value?: (row: Row) => unknown;
}

/** Searchable text of a cell: scalars, arrays and references (name + code). */
export function searchableText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (isRefValue(value)) return [value.name, value.code].filter(Boolean).join(" ");
  if (typeof value === "object") return "";
  return String(value);
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function readField<Row>(row: Row, field: KeywordField<Row>): unknown {
  return field.value ? field.value(row) : (row as Record<string, unknown>)[field.key];
}

/** True when the keyword is empty or ANY configured field contains it. */
export function matchesKeyword<Row>(
  row: Row,
  keyword: string,
  fields: readonly KeywordField<Row>[],
): boolean {
  const needle = normalizeKeyword(keyword);
  if (!needle) return true;
  return fields.some((field) => searchableText(readField(row, field)).toLowerCase().includes(needle));
}

/* ------------------------------------------------------------------ */
/* 高级筛选 · AND of filled conditions                                   */
/* ------------------------------------------------------------------ */

export type CellReader<Row> = (row: Row, code: string) => unknown;

const readProperty = <Row,>(row: Row, code: string) => (row as Record<string, unknown>)[code];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Comparable key of a cell: reference id, number, or (date-trimmed) text. */
function comparable(cell: unknown, against: unknown): string | number | null {
  if (isEmptyValue(cell)) return null;
  if (isRefValue(cell)) return cell.id;
  if (typeof against === "number") {
    const n = typeof cell === "number" ? cell : Number(cell);
    return Number.isFinite(n) ? n : null;
  }
  const text = String(cell);
  // A date condition (YYYY-MM-DD) compares against the day part of a datetime cell.
  return typeof against === "string" && DATE_ONLY.test(against) ? text.slice(0, 10) : text;
}

function scalarKey(value: unknown): string {
  return isRefValue(value) ? value.id : String(value);
}

function compare(cell: unknown, bound: unknown, test: (order: number) => boolean): boolean {
  const left = comparable(cell, bound);
  if (left === null || bound === null || bound === undefined) return false;
  const right = typeof bound === "number" ? bound : String(bound);
  if (typeof left === "number" && typeof right === "number") return test(left - right);
  return test(String(left).localeCompare(String(right)));
}

/** One QueryFilter against one row (client-side counterpart of the server query). */
export function matchesFilter<Row>(row: Row, filter: QueryFilter, read: CellReader<Row> = readProperty): boolean {
  const cell = read(row, filter.field);
  const value = filter.value;
  switch (filter.operator) {
    case "LIKE":
    case "NOT_LIKE": {
      const hit = searchableText(cell).toLowerCase().includes(searchableText(value).trim().toLowerCase());
      return filter.operator === "LIKE" ? hit : !hit;
    }
    case "EQ":
    case "NE": {
      const cells = (Array.isArray(cell) ? cell : [cell]).filter((item) => !isEmptyValue(item));
      const hit = cells.some((item) => scalarKey(item) === scalarKey(value));
      return filter.operator === "EQ" ? hit : !hit;
    }
    case "IN":
    case "NOT_IN": {
      const wanted = new Set((Array.isArray(value) ? value : [value]).map(scalarKey));
      const cells = (Array.isArray(cell) ? cell : [cell]).filter((item) => !isEmptyValue(item));
      const hit = cells.some((item) => wanted.has(scalarKey(item)));
      return filter.operator === "IN" ? hit : !hit;
    }
    case "BETWEEN": {
      const [lower, upper] = Array.isArray(value) ? value : [null, null];
      return compare(cell, lower, (order) => order >= 0) && compare(cell, upper, (order) => order <= 0);
    }
    case "GT":
      return compare(cell, value, (order) => order > 0);
    case "GTE":
      return compare(cell, value, (order) => order >= 0);
    case "LT":
      return compare(cell, value, (order) => order < 0);
    case "LTE":
      return compare(cell, value, (order) => order <= 0);
    case "IS_NULL":
      return isEmptyValue(cell);
    case "NOT_NULL":
      return !isEmptyValue(cell);
    case "DYNAMIC": {
      const range = resolveDynamicDate(value as DynamicDateValue);
      return range ? matchesFilter(row, { field: filter.field, operator: "BETWEEN", value: range }, read) : true;
    }
  }
}

/** AND of every filter; an empty list matches everything. */
export function matchesFilters<Row>(
  row: Row,
  filters: readonly QueryFilter[],
  read: CellReader<Row> = readProperty,
): boolean {
  return filters.every((filter) => matchesFilter(row, filter, read));
}

/* ------------------------------------------------------------------ */
/* Both together                                                        */
/* ------------------------------------------------------------------ */

export interface ListSearchState<Row> {
  /** 关键词搜索 input. */
  keyword?: string;
  keywordFields?: readonly KeywordField<Row>[];
  /** 高级筛选 conditions and their applied values. */
  conditions?: readonly FieldDef[];
  values?: SearchValues;
  read?: CellReader<Row>;
}

/** Rows matching the keyword AND every filled advanced-filter condition. */
export function filterListRows<Row>(rows: readonly Row[], state: ListSearchState<Row>): Row[] {
  const filters = state.conditions && state.values ? buildQueryFilters(state.conditions, state.values) : [];
  const keyword = state.keyword ?? "";
  const fields = state.keywordFields ?? [];
  return rows.filter(
    (row) => matchesKeyword(row, keyword, fields) && matchesFilters(row, filters, state.read ?? readProperty),
  );
}

/* ------------------------------------------------------------------ */
/* Active condition labels                                              */
/* ------------------------------------------------------------------ */

function optionLabel(field: FieldDef, value: unknown): string {
  return field.options?.find((option) => String(option.value) === String(value))?.label ?? String(value);
}

function refNames(value: unknown): string {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter(isRefValue)
    .map((ref) => ref.name || ref.code || ref.id)
    .join("、");
}

/**
 * Short text of one filled condition, e.g. 「任务名称：装配」「计划日期：2026-11-01 ~ 2026-11-30」;
 * null when the condition is empty (it does not take part in filtering).
 */
export function describeCondition(field: FieldDef, value: unknown): string | null {
  const [filter] = buildQueryFilters([field], { [field.code]: value });
  if (!filter) return null;
  const name = field.name;
  switch (searchControlKind(field)) {
    case "text":
      return `${name}：${String(filter.value)}`;
    case "number":
      return `${name}：${String(filter.value)}`;
    case "number-range":
    case "date-range": {
      if (filter.operator === "GTE") return `${name} ≥ ${String(filter.value)}`;
      if (filter.operator === "LTE") return `${name} ≤ ${String(filter.value)}`;
      const [lower, upper] = filter.value as [unknown, unknown];
      const open = (bound: unknown) => bound === "1970-01-01" || bound === "9999-12-31";
      if (open(lower)) return `${name} ≤ ${String(upper)}`;
      if (open(upper)) return `${name} ≥ ${String(lower)}`;
      return `${name}：${String(lower)} ~ ${String(upper)}`;
    }
    case "select":
      return `${name}：${optionLabel(field, value)}`;
    case "multi-select":
      return `${name}：${(filter.value as unknown[]).map((item) => optionLabel(field, item)).join("、")}`;
    case "person":
    case "reference":
      return `${name}：${refNames(value)}`;
    default:
      return null;
  }
}
