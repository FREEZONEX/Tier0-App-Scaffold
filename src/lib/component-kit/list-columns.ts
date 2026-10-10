/**
 * Column layout helpers for 字段配置 (list prefs) and the view editor's
 * 字段配置 tab: effective fields ⇄ ordered column states ⇄ `ColumnPref` maps.
 */
import type { ColumnPref, EffectiveField, FieldDef, RowHeight, SortSpec } from "@/lib/component-kit/types";

export type FixedSide = "left" | "right" | null;

export interface ColumnState {
  code: string;
  name: string;
  field: FieldDef;
  hidden: boolean;
  fixed: FixedSide;
  width?: number;
}

export const ROW_HEIGHT_OPTIONS: readonly { value: RowHeight; label: string }[] = [
  { value: "LOW", label: "低" },
  { value: "MID", label: "中" },
  { value: "HIGH", label: "高" },
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const FIXED_RANK: Record<string, number> = { left: 0, none: 1, right: 2 };

function fixedKey(fixed: FixedSide | undefined): "left" | "right" | "none" {
  return fixed === "left" || fixed === "right" ? fixed : "none";
}

/** Effective hidden flag: explicit `hidden`, else the field's default `visible: false`. */
export function isFieldHidden(field: EffectiveField): boolean {
  if (typeof field.hidden === "boolean") return field.hidden;
  return field.visible === false;
}

/** Ordered states: left-fixed, unfixed, right-fixed; each by `order`, then original position. */
export function columnStatesFrom(fields: readonly EffectiveField[]): ColumnState[] {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const rank = FIXED_RANK[fixedKey(a.field.fixed)] - FIXED_RANK[fixedKey(b.field.fixed)];
      if (rank !== 0) return rank;
      const orderA = a.field.order ?? a.index;
      const orderB = b.field.order ?? b.index;
      return orderA === orderB ? a.index - b.index : orderA - orderB;
    })
    .map(({ field }) => ({
      code: field.code,
      name: field.name,
      field,
      hidden: isFieldHidden(field),
      fixed: field.fixed === "left" || field.fixed === "right" ? field.fixed : null,
      width: field.width,
    }));
}

/** Keep states grouped by fixed side (stable within each group). */
export function normalizeColumnStates(states: readonly ColumnState[]): ColumnState[] {
  return states
    .map((state, index) => ({ state, index }))
    .sort((a, b) => FIXED_RANK[fixedKey(a.state.fixed)] - FIXED_RANK[fixedKey(b.state.fixed)] || a.index - b.index)
    .map(({ state }) => state);
}

export function toColumnPrefs(states: readonly ColumnState[]): Record<string, ColumnPref> {
  const prefs: Record<string, ColumnPref> = {};
  normalizeColumnStates(states).forEach((state, index) => {
    prefs[state.code] = {
      hidden: state.hidden,
      fixed: state.fixed,
      order: index + 1,
      ...(state.width ? { width: state.width } : {}),
    };
  });
  return prefs;
}

/** Apply a full column pref map to effective fields (used right after an instant prefs save). */
export function applyColumnPrefs(fields: readonly EffectiveField[], prefs: Record<string, ColumnPref> | null | undefined): EffectiveField[] {
  if (!prefs || Object.keys(prefs).length === 0) return [...fields];
  return fields.map((field) => {
    const pref = prefs[field.code];
    if (!pref) return field;
    return {
      ...field,
      hidden: typeof pref.hidden === "boolean" ? pref.hidden : field.hidden,
      fixed: pref.fixed === undefined ? field.fixed : pref.fixed,
      order: typeof pref.order === "number" ? pref.order : field.order,
      width: typeof pref.width === "number" && pref.width > 0 ? pref.width : field.width,
    };
  });
}

/** Visible columns in render order. */
export function visibleColumns(fields: readonly EffectiveField[]): ColumnState[] {
  return columnStatesFrom(fields).filter((state) => !state.hidden);
}

/** Move an item inside an array (drag-and-drop reorder). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function sameSorts(a: readonly SortSpec[], b: readonly SortSpec[]): boolean {
  return a.length === b.length && a.every((sort, index) => sort.field === b[index].field && sort.direction === b[index].direction);
}

type WidthField = Pick<FieldDef, "code" | "name" | "type" | "widget" | "width">;

/** 编码 / 编号 / 单号 / 流水号 columns (and the object's primary field). */
export function isCodeLikeField(field: Pick<FieldDef, "code" | "name" | "type">, primaryField?: string): boolean {
  if (field.type !== "TEXT" && field.type !== "RELATION_ATTRIBUTE" && field.type !== "RELATION_REFERENCE") return false;
  return field.code === primaryField || /编码|编号|单号|流水号|批次号/.test(field.name);
}

/**
 * Smallest width that still shows a typical value in full (14px text + 24px cell padding):
 * codes up to ~17 characters (GYLX2026062200001), DATETIME_SECOND「2026-09-17 15:50:39」,
 * DATETIME_MINUTE and DATE values.
 */
export function minColumnWidth(field: WidthField, primaryField?: string): number {
  if (field.type === "DATETIME") {
    const precision = field.widget?.displayPrecision ?? field.widget?.dateTimeDisplayType;
    if (precision === "DATE") return 110;
    if (precision === "DATETIME_MINUTE") return 150;
    return 180;
  }
  return isCodeLikeField(field, primaryField) ? 180 : 0;
}

/** Column width: the definition's (or preference) width, else a type default — never below `minColumnWidth`. */
export function defaultColumnWidth(field: WidthField, primaryField?: string): number {
  let base: number;
  if (field.width && field.width > 0) base = field.width;
  else {
    switch (field.type) {
      case "DATETIME":
        base = field.widget?.displayPrecision === "DATE" ? 120 : 170;
        break;
      case "NUMBER":
        base = 110;
        break;
      case "IMAGE":
        base = 100;
        break;
      case "SINGLE_SELECT":
        base = 110;
        break;
      default:
        base = 150;
    }
  }
  return Math.max(base, minColumnWidth(field, primaryField));
}
