/**
 * Search-area model shared by MetaListPage, ReferencePicker and the view
 * editor: which control a search condition renders, how draft values become
 * `QueryFilter[]`, and how relative (动态筛选) dates resolve.
 *
 * Pure module — safe for the server (e.g. to describe or pre-resolve filters).
 */
import { isEmptyValue, isRefValue, shanghaiParts, shanghaiToday, shiftYmd } from "@/lib/component-kit/format";
import type {
  DynamicDatePreset,
  DynamicDateValue,
  FieldDef,
  FilterOperator,
  QueryFilter,
  RefValue,
} from "@/lib/component-kit/types";

/* ------------------------------------------------------------------ */
/* Controls                                                             */
/* ------------------------------------------------------------------ */

export type SearchControlKind =
  | "text"
  | "number"
  | "number-range"
  | "date-range"
  | "select"
  | "multi-select"
  | "person"
  | "reference"
  | "none";

/** Values held by the search form, keyed by condition code. */
export type SearchValues = Record<string, unknown>;

export const PERSON_OBJECT_CODES = new Set(["person"]);

export function isPersonField(field: Pick<FieldDef, "reference">): boolean {
  return Boolean(field.reference && PERSON_OBJECT_CODES.has(field.reference.objectCode));
}

export function defaultOperator(field: FieldDef): FilterOperator {
  const first = field.operators?.[0];
  if (first) return first;
  switch (field.type) {
    case "NUMBER":
    case "DATETIME":
      return "BETWEEN";
    case "SINGLE_SELECT":
    case "RELATION_OBJECT":
      return "EQ";
    case "MULTI_SELECT":
      return "IN";
    default:
      return "LIKE";
  }
}

/** True when a relation / select search condition accepts several values. */
export function isMultiValueCondition(field: FieldDef): boolean {
  const operator = defaultOperator(field);
  if (field.type === "MULTI_SELECT") return true;
  if (operator === "IN" || operator === "NOT_IN") return true;
  return field.widget?.selectionMode === "MULTIPLE" && field.type === "RELATION_OBJECT";
}

/**
 * 查询区不渲染的条件：字典标「隐藏」(`widget.hidden`) 或 `visible: false`（如工序的「搜索关键字」、
 * 执行日志的 moduleCode）。它们仍可用于程序化 fixedFilters。
 */
/**
 * 查询区不渲染的条件：条件本身 visible=false（灵动字典「隐藏」的条件都带这个标记）
 * 或 widget.hidden。widget.visible 是表单显隐（如生产订单「创建人」），查询区照常显示。
 */
export function isHiddenSearchCondition(field: FieldDef): boolean {
  return field.visible === false || field.widget?.hidden === true;
}

/** 视图「数据过滤」候选里不列出的字段（字典「隐藏」）；列的默认显隐 `visible` 不影响。 */
export function isHiddenFilterCandidate(field: FieldDef): boolean {
  return field.widget?.hidden === true;
}

export function searchControlKind(field: FieldDef): SearchControlKind {
  const operator = defaultOperator(field);
  switch (field.type) {
    case "NUMBER":
      return operator === "BETWEEN" ? "number-range" : "number";
    case "DATETIME":
      return "date-range";
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      return isMultiValueCondition(field) ? "multi-select" : "select";
    case "RELATION_OBJECT":
      return isPersonField(field) ? "person" : "reference";
    case "IMAGE":
    case "ATTACHMENT":
      return "none";
    default:
      return "text";
  }
}

/** Empty value for a condition (used by 重置). */
export function emptySearchValue(field: FieldDef): unknown {
  switch (searchControlKind(field)) {
    case "number-range":
    case "date-range":
      return [null, null];
    case "multi-select":
      return [];
    case "person":
    case "reference":
      return isMultiValueCondition(field) ? [] : null;
    case "number":
    case "select":
      return null;
    default:
      return "";
  }
}

/**
 * Default value of a search condition: `widget.defaultValue` when it fits the
 * control (range → [from, to], multi → array), otherwise the empty value.
 */
export function defaultSearchValue(field: FieldDef): unknown {
  const empty = emptySearchValue(field);
  const preset = field.widget?.defaultValue;
  if (preset === undefined || preset === null) return empty;
  if (Array.isArray(empty)) {
    if (empty.length === 2) return Array.isArray(preset) && preset.length === 2 ? preset : empty;
    return Array.isArray(preset) ? preset : [preset];
  }
  return Array.isArray(preset) ? empty : preset;
}

/* ------------------------------------------------------------------ */
/* Draft values → filters                                               */
/* ------------------------------------------------------------------ */

function refIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((item) => (isRefValue(item) ? item.id : typeof item === "string" ? item : null))
    .filter((id): id is string => Boolean(id));
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** One condition value → filter, or null when the condition is empty. */
export function conditionToFilter(field: FieldDef, value: unknown): QueryFilter | null {
  const operator = defaultOperator(field);
  switch (searchControlKind(field)) {
    case "none":
      return null;
    case "text": {
      const text = typeof value === "string" ? value.trim() : isEmptyValue(value) ? "" : String(value);
      if (!text) return null;
      return { field: field.code, operator: operator === "BETWEEN" ? "LIKE" : operator, value: text };
    }
    case "number": {
      const numeric = numberOrNull(value);
      return numeric === null ? null : { field: field.code, operator, value: numeric };
    }
    case "number-range": {
      const [min, max] = Array.isArray(value) ? value : [null, null];
      const from = numberOrNull(min);
      const to = numberOrNull(max);
      if (from === null && to === null) return null;
      if (from !== null && to !== null) return { field: field.code, operator: "BETWEEN", value: [Math.min(from, to), Math.max(from, to)] };
      return from !== null
        ? { field: field.code, operator: "GTE", value: from }
        : { field: field.code, operator: "LTE", value: to };
    }
    case "date-range": {
      const [start, end] = Array.isArray(value) ? value : [null, null];
      const from = dateOrNull(start);
      const to = dateOrNull(end);
      if (!from && !to) return null;
      const lower = from ?? "1970-01-01";
      const upper = to ?? "9999-12-31";
      return { field: field.code, operator: "BETWEEN", value: lower <= upper ? [lower, upper] : [upper, lower] };
    }
    case "select": {
      if (value === null || value === undefined || value === "") return null;
      return operator === "IN" || operator === "NOT_IN"
        ? { field: field.code, operator, value: [value] }
        : { field: field.code, operator: operator === "LIKE" ? "EQ" : operator, value };
    }
    case "multi-select": {
      const values = (Array.isArray(value) ? value : [value]).filter((item) => item !== null && item !== undefined && item !== "");
      if (!values.length) return null;
      return { field: field.code, operator: operator === "NOT_IN" ? "NOT_IN" : "IN", value: values };
    }
    case "person":
    case "reference": {
      const ids = refIds(value);
      if (!ids.length) return null;
      if (isMultiValueCondition(field)) {
        return { field: field.code, operator: operator === "NOT_IN" ? "NOT_IN" : "IN", value: ids };
      }
      return { field: field.code, operator: "EQ", value: ids[0] };
    }
    default:
      return null;
  }
}

export function buildQueryFilters(conditions: readonly FieldDef[], values: SearchValues): QueryFilter[] {
  const filters: QueryFilter[] = [];
  for (const field of conditions) {
    const filter = conditionToFilter(field, values[field.code]);
    if (filter) filters.push(filter);
  }
  return filters;
}

export function countActiveConditions(conditions: readonly FieldDef[], values: SearchValues): number {
  return buildQueryFilters(conditions, values).length;
}

/* ------------------------------------------------------------------ */
/* View filter operators (数据过滤)                                      */
/* ------------------------------------------------------------------ */

export interface OperatorOption {
  value: FilterOperator;
  label: string;
}

/** The nine date operators of the 灵动 view editor, in its order. */
export const DATE_OPERATORS: readonly OperatorOption[] = [
  { value: "BETWEEN", label: "介于" },
  { value: "DYNAMIC", label: "动态筛选" },
  { value: "LT", label: "小于" },
  { value: "LTE", label: "小于等于" },
  { value: "EQ", label: "等于" },
  { value: "GT", label: "大于" },
  { value: "GTE", label: "大于等于" },
  { value: "IS_NULL", label: "为空" },
  { value: "NOT_NULL", label: "不为空" },
];

export const NUMBER_OPERATORS: readonly OperatorOption[] = [
  { value: "EQ", label: "等于" },
  { value: "NE", label: "不等于" },
  { value: "BETWEEN", label: "介于" },
  { value: "GT", label: "大于" },
  { value: "GTE", label: "大于等于" },
  { value: "LT", label: "小于" },
  { value: "LTE", label: "小于等于" },
  { value: "IS_NULL", label: "为空" },
  { value: "NOT_NULL", label: "不为空" },
];

export const TEXT_OPERATORS: readonly OperatorOption[] = [
  { value: "LIKE", label: "包含" },
  { value: "NOT_LIKE", label: "不包含" },
  { value: "EQ", label: "等于" },
  { value: "NE", label: "不等于" },
  { value: "IS_NULL", label: "为空" },
  { value: "NOT_NULL", label: "不为空" },
];

export const SELECT_OPERATORS: readonly OperatorOption[] = [
  { value: "IN", label: "等于任意一个" },
  { value: "NOT_IN", label: "不等于任意一个" },
  { value: "IS_NULL", label: "为空" },
  { value: "NOT_NULL", label: "不为空" },
];

export const RELATION_OPERATORS: readonly OperatorOption[] = [
  { value: "IN", label: "等于任意一个" },
  { value: "NOT_IN", label: "不等于任意一个" },
  { value: "IS_NULL", label: "为空" },
  { value: "NOT_NULL", label: "不为空" },
];

export function operatorOptionsFor(field: Pick<FieldDef, "type">): readonly OperatorOption[] {
  switch (field.type) {
    case "DATETIME":
      return DATE_OPERATORS;
    case "NUMBER":
      return NUMBER_OPERATORS;
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      return SELECT_OPERATORS;
    case "RELATION_OBJECT":
      return RELATION_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
}

export function operatorLabel(operator: FilterOperator): string {
  const all = [...DATE_OPERATORS, ...NUMBER_OPERATORS, ...TEXT_OPERATORS, ...SELECT_OPERATORS];
  return all.find((option) => option.value === operator)?.label ?? operator;
}

export function operatorTakesValue(operator: FilterOperator): boolean {
  return operator !== "IS_NULL" && operator !== "NOT_NULL";
}

/* ------------------------------------------------------------------ */
/* Dynamic dates (动态筛选)                                              */
/* ------------------------------------------------------------------ */

export const DYNAMIC_DATE_PRESETS: readonly { value: DynamicDatePreset; label: string }[] = [
  { value: "TODAY", label: "今天" },
  { value: "YESTERDAY", label: "昨天" },
  { value: "THIS_WEEK", label: "本周" },
  { value: "LAST_WEEK", label: "上周" },
  { value: "THIS_MONTH", label: "本月" },
  { value: "LAST_MONTH", label: "上月" },
  { value: "LAST_3_MONTHS", label: "过去3个月" },
  { value: "CUSTOM", label: "自定义" },
  { value: "CUSTOM_RANGE", label: "自定义(范围)" },
];

export const DYNAMIC_UNITS: readonly { value: "DAY" | "WEEK" | "MONTH"; label: string }[] = [
  { value: "DAY", label: "日" },
  { value: "WEEK", label: "周" },
  { value: "MONTH", label: "月" },
];

/** The fixed first filter of every view:「创建时间 · 动态筛选 · 自定义(范围) · 过去 365 日 ~ 当前 1 日」. */
export function defaultTimeFilter(field = "createTime"): QueryFilter {
  return {
    field,
    operator: "DYNAMIC",
    value: { preset: "CUSTOM_RANGE", pastAmount: 365, pastUnit: "DAY", currentAmount: 1, currentUnit: "DAY" } satisfies DynamicDateValue,
  };
}

export function defaultCreateTimeFilter(): QueryFilter {
  return defaultTimeFilter("createTime");
}

/**
 * Field of a view's fixed first 数据过滤 row, from the object's filter candidates:
 * 创建时间 (createTime), else 申请时间 (applyTime — 入库单 / 出库单), else the first date field.
 */
export function viewTimeFieldCode(fields: readonly Pick<FieldDef, "code" | "type">[]): string | null {
  if (fields.some((field) => field.code === "createTime")) return "createTime";
  if (fields.some((field) => field.code === "applyTime")) return "applyTime";
  return fields.find((field) => field.type === "DATETIME")?.code ?? null;
}

/**
 * Legacy `createTime` filters on objects without 创建时间 point at the object's time field
 * (seeded 入库单 / 出库单 views were saved with createTime).
 */
export function migrateViewTimeFilters(
  filters: readonly QueryFilter[],
  fields: readonly Pick<FieldDef, "code" | "type">[],
): QueryFilter[] {
  const timeField = viewTimeFieldCode(fields);
  if (!timeField || timeField === "createTime" || fields.some((field) => field.code === "createTime")) return [...filters];
  return filters.map((filter) => (filter.field === "createTime" ? { ...filter, field: timeField } : filter));
}

/** 数据过滤 as the view editor shows it: the object's time filter first (added when missing). */
export function withViewTimeFilterFirst(
  filters: readonly QueryFilter[],
  fields: readonly Pick<FieldDef, "code" | "type">[],
): QueryFilter[] {
  const migrated = migrateViewTimeFilters(filters, fields);
  const timeField = viewTimeFieldCode(fields);
  if (!timeField) return migrated;
  const index = migrated.findIndex((filter) => filter.field === timeField);
  if (index === 0) return migrated;
  if (index > 0) {
    const [time] = migrated.splice(index, 1);
    return [time, ...migrated];
  }
  return [defaultTimeFilter(timeField), ...migrated];
}

function ymdOf(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function mondayOf(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return shiftYmd(ymd, weekday === 0 ? -6 : 1 - weekday);
}

function monthStart(ymd: string, offsetMonths = 0): string {
  const [year, month] = ymd.split("-").map(Number);
  return ymdOf(year, month + offsetMonths, 1);
}

function monthEnd(ymd: string, offsetMonths = 0): string {
  const [year, month] = ymd.split("-").map(Number);
  return ymdOf(year, month + offsetMonths + 1, 0);
}

function shiftMonthsKeepDay(ymd: string, months: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return ymdOf(year, month + months, Math.min(day, lastDay));
}

/** Inclusive calendar range ["YYYY-MM-DD", "YYYY-MM-DD"] in Asia/Shanghai; weeks start on Monday. */
export function resolveDynamicDate(value: DynamicDateValue, now: Date = new Date()): [string, string] | null {
  const today = shanghaiToday(now);
  switch (value.preset) {
    case "TODAY":
      return [today, today];
    case "YESTERDAY": {
      const yesterday = shiftYmd(today, -1);
      return [yesterday, yesterday];
    }
    case "THIS_WEEK": {
      const monday = mondayOf(today);
      return [monday, shiftYmd(monday, 6)];
    }
    case "LAST_WEEK": {
      const monday = shiftYmd(mondayOf(today), -7);
      return [monday, shiftYmd(monday, 6)];
    }
    case "THIS_MONTH":
      return [monthStart(today), monthEnd(today)];
    case "LAST_MONTH":
      return [monthStart(today, -1), monthEnd(today, -1)];
    case "LAST_3_MONTHS":
      return [shiftMonthsKeepDay(today, -3), today];
    case "CUSTOM":
      return value.date ? [value.date, value.date] : null;
    case "CUSTOM_RANGE": {
      const pastAmount = Math.max(0, Math.trunc(value.pastAmount ?? 0));
      const currentAmount = Math.max(1, Math.trunc(value.currentAmount ?? 1));
      const pastUnit = value.pastUnit ?? "DAY";
      const currentUnit = value.currentUnit ?? "DAY";
      const from =
        pastUnit === "DAY"
          ? shiftYmd(today, -pastAmount)
          : pastUnit === "WEEK"
            ? shiftYmd(mondayOf(today), -7 * pastAmount)
            : monthStart(today, -pastAmount);
      const to =
        currentUnit === "DAY"
          ? shiftYmd(today, currentAmount - 1)
          : currentUnit === "WEEK"
            ? shiftYmd(mondayOf(today), 7 * currentAmount - 1)
            : monthEnd(today, currentAmount - 1);
      return [from, to];
    }
    default:
      return null;
  }
}

export function describeDynamicDate(value: DynamicDateValue | null | undefined): string {
  if (!value) return "";
  const preset = DYNAMIC_DATE_PRESETS.find((item) => item.value === value.preset)?.label ?? value.preset;
  if (value.preset === "CUSTOM") return `${preset} ${value.date ?? ""}`.trim();
  if (value.preset !== "CUSTOM_RANGE") return preset;
  const unit = (code: string | undefined) => DYNAMIC_UNITS.find((item) => item.value === code)?.label ?? "日";
  return `过去 ${value.pastAmount ?? 0} ${unit(value.pastUnit)} ~ 当前 ${value.currentAmount ?? 1} ${unit(value.currentUnit)}`;
}

/** Current Shanghai clock parts — exported for components that need "now" outside render. */
export function nowParts(now: Date = new Date()) {
  return shanghaiParts(now);
}

/* ------------------------------------------------------------------ */
/* Request keys                                                         */
/* ------------------------------------------------------------------ */

/** Deterministic JSON (sorted object keys) for `useRequest` keys. */
export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
}

/** Reference values picked in a search box, normalized to an array. */
export function toRefArray(value: unknown): RefValue[] {
  if (Array.isArray(value)) return value.filter(isRefValue);
  return isRefValue(value) ? [value] : [];
}
