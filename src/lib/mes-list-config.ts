"use client";

/**
 * MetaListPage configuration for batches and recipes, plus the component-kit
 * adapter that maps the kit's logical `meta/*` requests to this App's API.
 */
import type { ComponentKitAdapter } from "@/components/kit/provider";
import type { EffectivePageConfig, FieldDef, UserListPrefs } from "@/lib/component-kit/types";
import { can, type RoleInput } from "@/lib/permissions";
import { apiUrl } from "@/lib/utils";
import { BATCH_STATUS_LABEL } from "@/lib/mes-domain";
import { sendJson } from "@/lib/mes-client";

export const BATCH_OBJECT = "mes_batch";
export const RECIPE_OBJECT = "mes_recipe";

const DEFAULT_PREFS: UserListPrefs = { columns: {}, sorts: [], rowHeight: "MID", pageSize: 20 };

const batchStatusOptions = (Object.keys(BATCH_STATUS_LABEL) as (keyof typeof BATCH_STATUS_LABEL)[]).map(
  (value) => ({ value, label: BATCH_STATUS_LABEL[value] }),
);

const batchColumns: FieldDef[] = [
  { code: "code", name: "批次号", type: "TEXT", widget: {}, width: 150, sortable: true },
  { code: "status", name: "状态", type: "SINGLE_SELECT", widget: { businessRender: true }, options: batchStatusOptions, width: 110 },
  { code: "productName", name: "产品", type: "TEXT", widget: {}, width: 140 },
  { code: "recipeCode", name: "配方", type: "TEXT", widget: {}, width: 130 },
  { code: "reactor", name: "反应釜", type: "TEXT", widget: {}, width: 100, sortable: true },
  { code: "targetOutputKg", name: "目标产量 (kg)", type: "NUMBER", widget: { decimalPlaces: 2, trimTrailingZeros: true }, width: 130, sortable: true },
  { code: "progress", name: "投料进度", type: "TEXT", widget: { businessRender: true }, width: 150 },
  { code: "plannedStartAt", name: "计划开工", type: "DATETIME", widget: { displayPrecision: "DATETIME_MINUTE" }, width: 160, sortable: true },
];

const batchSearch: FieldDef[] = [
  { code: "code", name: "批次号", type: "TEXT", widget: { placeholder: "输入批次号" }, operators: ["LIKE"] },
  { code: "productName", name: "产品", type: "TEXT", widget: { placeholder: "输入产品名称" }, operators: ["LIKE"] },
  { code: "reactor", name: "反应釜", type: "TEXT", widget: { placeholder: "如 R-201" }, operators: ["LIKE"] },
  { code: "plannedStartAt", name: "计划开工", type: "DATETIME", widget: { isRange: true, displayPrecision: "DATE" }, operators: ["BETWEEN"] },
];

const recipeColumns: FieldDef[] = [
  { code: "code", name: "配方编码", type: "TEXT", widget: {}, width: 140, sortable: true },
  { code: "name", name: "配方名称", type: "TEXT", widget: {}, width: 170 },
  { code: "productName", name: "产品", type: "TEXT", widget: {}, width: 140 },
  { code: "version", name: "版本", type: "TEXT", widget: {}, width: 90 },
  { code: "baseOutputKg", name: "基准产量 (kg)", type: "NUMBER", widget: { decimalPlaces: 2, trimTrailingZeros: true }, width: 130 },
  { code: "stepCount", name: "投料步骤", type: "NUMBER", widget: {}, width: 100 },
  { code: "status", name: "状态", type: "TEXT", widget: { businessRender: true }, width: 100 },
];

const recipeSearch: FieldDef[] = [
  { code: "code", name: "配方编码", type: "TEXT", widget: { placeholder: "输入配方编码" }, operators: ["LIKE"] },
  { code: "productName", name: "产品", type: "TEXT", widget: { placeholder: "输入产品名称" }, operators: ["LIKE"] },
];

function pageConfig(
  objectCode: string,
  objectName: string,
  columns: FieldDef[],
  search: FieldDef[],
): EffectivePageConfig {
  return {
    objectCode,
    objectName,
    module: "mes",
    primaryField: "code",
    statusField: "status",
    capabilities: {},
    searchConditions: search,
    listColumns: columns,
    formSections: [],
    views: [],
    activeView: null,
    prefs: DEFAULT_PREFS,
    groupingField: null,
  };
}

const CONFIGS: Record<string, EffectivePageConfig> = {
  [BATCH_OBJECT]: pageConfig(BATCH_OBJECT, "生产批次", batchColumns, batchSearch),
  [RECIPE_OBJECT]: pageConfig(RECIPE_OBJECT, "配方", recipeColumns, recipeSearch),
};

const OBJECT_ACTIONS: Record<string, Partial<Record<string, Parameters<typeof can>[1]>>> = {
  [BATCH_OBJECT]: { create: "plan_batches" },
  [RECIPE_OBJECT]: { create: "manage_recipes" },
};

function lastSegment(pathname: string): string {
  return decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
}

export function createMesKitAdapter(roles: RoleInput): ComponentKitAdapter {
  return {
    canObject: (objectCode, operation) => {
      const action = OBJECT_ACTIONS[objectCode]?.[operation];
      return action ? can(roles, action) : false;
    },
    request: async ({ path, method, body, signal }) => {
      const pathname = new URL(path, "http://app.invalid").pathname;
      if (pathname.includes("/meta/config/")) {
        const config = CONFIGS[lastSegment(pathname)];
        if (!config) throw new Error(`未配置列表对象：${lastSegment(pathname)}`);
        return config;
      }
      if (pathname.includes("/meta/query/")) {
        const objectCode = lastSegment(pathname);
        if (objectCode === BATCH_OBJECT) {
          return sendJson(apiUrl("/api/batches/query"), { method: "POST", body, signal });
        }
        if (objectCode === RECIPE_OBJECT) {
          return sendJson(apiUrl("/api/recipes/query"), { method: "POST", body, signal });
        }
        throw new Error(`未配置列表查询：${objectCode}`);
      }
      // Column widths, sort and page size stay in the browser session.
      if (pathname.includes("/meta/prefs/")) return { ...DEFAULT_PREFS, ...(body as object) };
      if (pathname.includes("/meta/active-view/")) return {};
      throw new Error(`当前应用未提供此操作：${method} ${pathname}`);
    },
  };
}
