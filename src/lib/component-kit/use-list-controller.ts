"use client";

import { useKitApi, type KitApi } from "@/components/kit/provider";


/**
 * State of one generic list (MetaListPage, ReferencePicker): search draft vs.
 * applied conditions, paging, sorts, row height, column prefs, 二级分组 and a
 * cross-page selection. Preference changes are applied locally at once and
 * saved with `PUT /api/meta/prefs/$objectCode` (灵动「即时保存」).
 *
 * The hook performs no reads; the component renders the query with
 * `useRequest(controller.requestKey, …)` + `<AsyncView>`.
 */
import { useCallback, useMemo, useState } from "react";

import {  } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { applyColumnPrefs, columnStatesFrom, toColumnPrefs, type ColumnState } from "@/lib/component-kit/list-columns";
import { buildQueryFilters, defaultSearchValue, stableKey, type SearchValues } from "@/lib/component-kit/query-model";
import type {
  ColumnPref,
  EffectiveField,
  EffectivePageConfig,
  QueryFilter,
  QueryRequest,
  RowHeight,
  SortSpec,
  UserListPrefs,
} from "@/lib/component-kit/types";

export type ListRow = Record<string, unknown> & { id: string };

export interface ListControllerOptions {
  objectCode: string;
  config: EffectivePageConfig;
  /** Always-on filters (page scope, parent record…). */
  fixedFilters?: readonly QueryFilter[];
  /** QueryRequest.scope, e.g. 我的任务 = "MINE". */
  scope?: string;
  /** Extra ids restriction. */
  ids?: readonly string[];
  /**
   * Search values applied when the list mounts (defaults and drill-down links). 重置 restores
   * `defaultSearch` when given, otherwise these values.
   */
  initialSearch?: SearchValues;
  /** 查询区默认条件: merged under `initialSearch` at mount and restored by 重置 (e.g. 创建时间近 3 个月). */
  defaultSearch?: SearchValues;
  defaultPageSize?: number;
  /** Save prefs to the server (false for pickers that only use them locally). */
  persistPrefs?: boolean;
  /** Bumps the request key (外部动作后刷新). */
  reloadKey?: string | number;
  /** Rows selected when the list mounts (reference picker 回显). */
  initialSelection?: readonly ListRow[];
}

export interface PrefsPatch {
  columns?: Record<string, ColumnPref>;
  sorts?: SortSpec[];
  rowHeight?: RowHeight;
  pageSize?: number;
}

export interface ListController {
  objectCode: string;
  viewCode: string | undefined;
  /* search */
  draft: SearchValues;
  setDraftValue: (code: string, value: unknown) => void;
  applySearch: () => void;
  resetSearch: () => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  appliedFilters: QueryFilter[];
  /* paging */
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  /* sorting */
  sorts: SortSpec[];
  saveSorts: (sorts: SortSpec[]) => Promise<void>;
  /* row height */
  rowHeight: RowHeight;
  saveRowHeight: (rowHeight: RowHeight) => Promise<void>;
  /* columns */
  columns: EffectiveField[];
  columnStates: ColumnState[];
  saveColumns: (states: ColumnState[]) => Promise<void>;
  /* 二级分组 */
  groupValue: string | number | null;
  setGroupValue: (value: string | number | null) => void;
  /* selection */
  selectedKeys: string[];
  selectedRows: ListRow[];
  onSelectionChange: (keys: string[], changed: { rows: ListRow[]; checked: boolean }) => void;
  refreshSelectedRows: (rows: readonly ListRow[]) => void;
  clearSelection: () => void;
  /* request */
  request: QueryRequest;
  requestKey: string;
  reload: () => void;
}

/** PUT /api/meta/prefs/$objectCode (partial update of the user's list prefs). */
export async function saveListPrefs(api: KitApi, objectCode: string, viewCode: string | undefined, patch: PrefsPatch): Promise<UserListPrefs> {
  return api.sendJson<UserListPrefs>(apiUrl(`/api/meta/prefs/${objectCode}`), {
    method: "PUT",
    body: { ...(viewCode ? { viewCode } : {}), ...patch },
  });
}

/** widget.defaultValue < defaultSearch < initialSearch. */
function initialDraft(config: EffectivePageConfig, ...layers: (SearchValues | undefined)[]): SearchValues {
  const values: SearchValues = {};
  for (const field of config.searchConditions) values[field.code] = defaultSearchValue(field);
  return Object.assign(values, ...layers.map((layer) => layer ?? {}));
}

export function useListController({
  objectCode,
  config,
  fixedFilters,
  scope,
  ids,
  initialSearch,
  defaultSearch,
  defaultPageSize = 10,
  persistPrefs = true,
  reloadKey,
  initialSelection,
}: ListControllerOptions): ListController {
  const api = useKitApi();
  const viewCode = config.activeView?.code;
  const [draft, setDraft] = useState<SearchValues>(() => initialDraft(config, defaultSearch, initialSearch));
  const [applied, setApplied] = useState<SearchValues>(() => initialDraft(config, defaultSearch, initialSearch));
  // 重置 goes back to the conditions the page opened with (not to an empty form).
  const [resetValues] = useState<SearchValues>(() =>
    defaultSearch ? initialDraft(config, defaultSearch) : initialDraft(config, initialSearch),
  );
  const [expanded, setExpanded] = useState(false);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(() => config.prefs?.pageSize || defaultPageSize);
  const [sorts, setSorts] = useState<SortSpec[]>(() => config.prefs?.sorts ?? []);
  const [rowHeight, setRowHeight] = useState<RowHeight>(() => config.prefs?.rowHeight ?? config.activeView?.rowHeight ?? "MID");
  const [columnPrefs, setColumnPrefs] = useState<Record<string, ColumnPref> | null>(null);
  const [groupValue, setGroupValueState] = useState<string | number | null>(null);
  const [selection, setSelection] = useState<Map<string, ListRow>>(
    () => new Map((initialSelection ?? []).map((row) => [String(row.id), row])),
  );
  const [reloadToken, setReloadToken] = useState(0);

  const persist = useCallback(
    async (patch: PrefsPatch) => {
      if (!persistPrefs) return;
      await saveListPrefs(api, objectCode, viewCode, patch);
    },
    [api, objectCode, persistPrefs, viewCode],
  );

  const columns = useMemo(() => applyColumnPrefs(config.listColumns, columnPrefs), [config.listColumns, columnPrefs]);
  const columnStates = useMemo(() => columnStatesFrom(columns), [columns]);

  const appliedFilters = useMemo(
    () => [...buildQueryFilters(config.searchConditions, applied), ...(fixedFilters ?? [])],
    [applied, config.searchConditions, fixedFilters],
  );

  const request = useMemo<QueryRequest>(() => {
    const next: QueryRequest = {
      filters: appliedFilters,
      page: { current: page, pageSize },
    };
    if (sorts.length) next.sorts = sorts;
    if (viewCode) next.viewCode = viewCode;
    if (groupValue !== null && groupValue !== undefined) next.groupValue = groupValue;
    if (scope) next.scope = scope;
    if (ids) next.ids = [...ids];
    return next;
  }, [appliedFilters, groupValue, ids, page, pageSize, scope, sorts, viewCode]);

  const requestKey = useMemo(
    () => `meta-query:${objectCode}:${stableKey(request)}:${reloadKey ?? ""}:${reloadToken}`,
    [objectCode, reloadKey, reloadToken, request],
  );

  const setDraftValue = useCallback((code: string, value: unknown) => {
    setDraft((current) => ({ ...current, [code]: value }));
  }, []);

  const applySearch = useCallback(() => {
    setApplied(draft);
    setPageState(1);
    setReloadToken((token) => token + 1);
  }, [draft]);

  const resetSearch = useCallback(() => {
    setDraft(resetValues);
    setApplied(resetValues);
    setPageState(1);
    setReloadToken((token) => token + 1);
  }, [resetValues]);

  const setPage = useCallback((next: number) => setPageState(Math.max(1, Math.trunc(next) || 1)), []);

  const setPageSize = useCallback(
    (next: number) => {
      setPageSizeState(next);
      setPageState(1);
      void persist({ pageSize: next }).catch(() => undefined);
    },
    [persist],
  );

  const saveSorts = useCallback(
    async (next: SortSpec[]) => {
      setSorts(next);
      setPageState(1);
      await persist({ sorts: next });
    },
    [persist],
  );

  const saveRowHeight = useCallback(
    async (next: RowHeight) => {
      setRowHeight(next);
      await persist({ rowHeight: next });
    },
    [persist],
  );

  const saveColumns = useCallback(
    async (states: ColumnState[]) => {
      const prefs = toColumnPrefs(states);
      setColumnPrefs(prefs);
      await persist({ columns: prefs });
    },
    [persist],
  );

  const setGroupValue = useCallback((value: string | number | null) => {
    setGroupValueState(value);
    setPageState(1);
  }, []);

  const onSelectionChange = useCallback((keys: string[], changed: { rows: ListRow[]; checked: boolean }) => {
    setSelection((current) => {
      const next = new Map(current);
      for (const row of changed.rows) {
        if (changed.checked) next.set(String(row.id), row);
        else next.delete(String(row.id));
      }
      const wanted = new Set(keys);
      for (const key of [...next.keys()]) {
        if (!wanted.has(key)) next.delete(key);
      }
      return next;
    });
  }, []);

  const refreshSelectedRows = useCallback((rows: readonly ListRow[]) => {
    setSelection((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const next = new Map(current);
      for (const row of rows) {
        const key = String(row.id);
        if (next.has(key) && next.get(key) !== row) {
          next.set(key, row);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  const clearSelection = useCallback(() => setSelection(new Map()), []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const selectedKeys = useMemo(() => [...selection.keys()], [selection]);
  const selectedRows = useMemo(() => [...selection.values()], [selection]);

  return {
    objectCode,
    viewCode,
    draft,
    setDraftValue,
    applySearch,
    resetSearch,
    expanded,
    setExpanded,
    appliedFilters,
    page,
    pageSize,
    setPage,
    setPageSize,
    sorts,
    saveSorts,
    rowHeight,
    saveRowHeight,
    columns,
    columnStates,
    saveColumns,
    groupValue,
    setGroupValue,
    selectedKeys,
    selectedRows,
    onSelectionChange,
    refreshSelectedRows,
    clearSelection,
    request,
    requestKey,
    reload,
  };
}
