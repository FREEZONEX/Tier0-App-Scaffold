"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * MetaListPage — the generic list page, laid out by the list action rules in
 * docs/component-kit.md (「列表页操作区规范」):
 *
 * 1. 页头: title | headerExtra (secondary, outline) · 创建 (the one primary, last).
 * 2. 视图页签 / 二级分组胶囊 when configured.
 * 3. 工具栏, one row: 范围页签 (topTabs) on the left; on the right 搜索框 ·
 *    筛选(n) · toolbarFilters · 导入 / 导出 / toolbarExtra · 表格设置
 *    (字段配置 / 排序 / 行高 icons). Selected rows swap the right side for the
 *    批量栏 (已选 N 项 · actions · 取消选择).
 * 4. 筛选面板 (other conditions), toolbarNote, table
 * (勾选、序号、类型图标、主字段链接、按类型渲染、操作列 + ⋯ 悬停菜单), 分页.
 *
 * Everything is driven by GET /api/meta/config/$objectCode and
 * POST /api/meta/query/$objectCode. Pages add business behaviour through
 * props: onCreate, rowActions, batchActions, onOpenRecord, cellRenderers…
 */
import { CirclePlus, FileInput, FileOutput, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SplitButton, TextButton } from "@/components/kit/ui/buttons";
import { PageContainer } from "@/components/kit/shell/page-layout";
import type { BackTarget } from "@/components/ui/back-button";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { HeaderSortButton } from "@/components/kit/meta/header-sort-button";
import { Pagination } from "@/components/kit/ui/pagination";
import { CapsuleGroup } from "@/components/kit/ui/tabs";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { errorMessage } from "@/lib/component-kit/api-client";
import { useRequest } from "@/lib/hooks";
import { formatFieldValue } from "@/lib/component-kit/format";
import { defaultColumnWidth, visibleColumns } from "@/lib/component-kit/list-columns";
import type { SearchValues } from "@/lib/component-kit/query-model";
import type {
  EffectivePageConfig,
  QueryFilter,
  QueryResult,
  RowHeight,
  SortSpec,
  ViewDef,
} from "@/lib/component-kit/types";
import { useListController, type ListRow } from "@/lib/component-kit/use-list-controller";
import { usePermissions } from "@/lib/component-kit/use-permissions";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { ExcelLogModal } from "@/components/kit/meta/excel-log-modal";
import { ExportDialog } from "@/components/kit/meta/export-dialog";
import { FieldConfigPopover } from "@/components/kit/meta/field-config-popover";
import { FieldValue } from "@/components/kit/meta/field-value";
import { ImportDialog } from "@/components/kit/meta/import-dialog";
import { PRINT_LIMIT, PrintDialog, printLimitMessage } from "@/components/kit/meta/print-dialog";
import { RowActions } from "@/components/kit/meta/row-actions";
import { RowHeightMenu } from "@/components/kit/meta/row-height-menu";
import { ListScopeSwitch } from "@/components/kit/meta/list-scope-switch";
import { ListFilterButton, ListFilterPanel, ListSearchBox, splitSearchConditions } from "@/components/kit/meta/list-filter-bar";
import { SortPopover } from "@/components/kit/meta/sort-popover";
import type { BatchAction, MetaListApi, RowAction, TopTab } from "@/components/kit/meta/types";
import { ViewEditorDrawer } from "@/components/kit/meta/view-editor-drawer";
import { ViewListDrawer } from "@/components/kit/meta/view-list-drawer";
import { ViewTabs } from "@/components/kit/meta/view-tabs";

export interface MetaListPageProps {
  objectCode: string;
  /** Page title above the list content. */
  title: ReactNode;
  /** Secondary page actions in the title row, before 创建 (outline buttons, icon-only below `sm`). */
  headerExtra?: ReactNode;
  /** Parent level when this list sits below another page (e.g. 某设备的保养记录). */
  back?: BackTarget;
  /** Text of the page's primary button, last in the title row (default 创建). Hidden without `onCreate`. */
  createLabel?: string;
  onCreate?: () => void;
  /** Extra data actions after 导出 (批量新增、默认单位…), outline buttons. */
  toolbarExtra?: ReactNode;
  /** Quick filters after 筛选 (same height as the toolbar controls). */
  toolbarFilters?: ReactNode;
  /** Short contextual note, presented below the controls. */
  toolbarNote?: ReactNode;
  rowActions?: (row: ListRow) => RowAction[];
  /** Inline row actions before ⋯ (default 2); a function gives a per-row count (e.g. 已结束任务 3, others 2). */
  inlineActionCount?: number | ((row: ListRow) => number);
  /** Fixed width of the 操作 column (default: fits the widest row). */
  actionColumnWidth?: number;
  batchActions?: (rows: ListRow[]) => BatchAction[];
  /** Click on the primary field (编码链接). */
  onOpenRecord?: (row: ListRow) => void;
  /** Cell overrides keyed by field code. */
  cellRenderers?: Record<string, (row: ListRow, context: { rowHeight: RowHeight }) => ReactNode>;
  topTabs?: TopTab[];
  defaultTopTab?: string;
  onTopTabChange?: (key: string) => void;
  /** Always-on filters. */
  fixedFilters?: QueryFilter[];
  /** Change to re-run the query after an external action. */
  reloadKey?: string | number;
  /** Defaults follow the object capabilities (and the user's permission points). */
  importable?: boolean;
  exportable?: boolean;
  printable?: boolean;
  /** Row checkboxes + 勾选批量栏 (default true). */
  selectable?: boolean;
  defaultPageSize?: number;
  /** Search values when the page opens (defaults, drill-down). 重置 restores `defaultSearch` if given, else these. */
  initialSearch?: SearchValues;
  /** 查询区默认条件 restored by 重置 (merged under initialSearch at open), e.g. 创建时间近 3 个月. */
  defaultSearch?: SearchValues;
  /** Receives the imperative list API (reload, openPrint…). */
  onReady?: (api: MetaListApi) => void;
  /** Called after each successful query (e.g. to show totals elsewhere). */
  onDataLoaded?: (result: QueryResult<ListRow>) => void;
  /**
   * 树形列表（父子记录）: ▸/▾ before `indentColumn` (default: first column); children are
   * loaded on expand, share columns / cellRenderers / rowActions, can be checked (key = id)
   * and don't count in pagination. Page, query and reloadKey changes collapse everything.
   */
  treeRows?: {
    hasChildren: (row: ListRow) => boolean;
    loadChildren: (row: ListRow) => Promise<ListRow[]>;
    indentColumn?: string;
  };
  className?: string;
}

function actionsWidth(actions: readonly RowAction[], inlineCount: number): number {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return 72;
  const inline = visible.slice(0, inlineCount);
  // Icon actions are fixed-size; always reserve the ⋯ slot so rows align.
  if (inline.length > 0 && inline.every((action) => action.icon)) {
    const slots = inline.length + 1;
    return Math.max(72, slots * 28 + Math.max(0, slots - 1) * 4 + 16);
  }
  const textWidth = inline.reduce((sum, action) => sum + action.label.length * 14, 0);
  const gaps = Math.max(0, inline.length - 1) * 12;
  const more = 36; // reserved ⋯ column
  return Math.max(72, textWidth + gaps + more + 28);
}

interface BodyProps extends MetaListPageProps {
  config: EffectivePageConfig;
  onSwitchView: (viewCode: string) => void;
  onReloadConfig: () => void;
}

function reportPrefsError(error: unknown) {
  toast.error(errorMessage(error, "个人偏好保存失败"));
}

function MetaListBody({
  objectCode,
  config,
  onSwitchView,
  onReloadConfig,
  toolbarExtra,
  toolbarFilters,
  toolbarNote,
  rowActions,
  inlineActionCount = 2,
  actionColumnWidth,
  batchActions,
  onOpenRecord,
  cellRenderers,
  topTabs,
  defaultTopTab,
  onTopTabChange,
  fixedFilters,
  reloadKey,
  importable,
  exportable,
  printable,
  selectable = true,
  defaultPageSize,
  initialSearch,
  defaultSearch,
  onReady,
  onDataLoaded,
  treeRows,
}: BodyProps) {
  const api = useKitApi();
  const permissions = usePermissions();
  const [topTab, setTopTab] = useState<string | undefined>(defaultTopTab ?? topTabs?.[0]?.key);
  const activeTop = topTabs?.find((tab) => tab.key === topTab);
  const filters = useMemo(
    () => [...(fixedFilters ?? []), ...(activeTop?.filters ?? [])],
    [activeTop?.filters, fixedFilters],
  );

  const controller = useListController({
    objectCode,
    config,
    fixedFilters: filters,
    scope: activeTop?.scope,
    reloadKey,
    defaultPageSize,
    initialSearch,
    defaultSearch,
  });

  const query = useRequest(controller.requestKey, (signal) =>
    api.sendJson<QueryResult<ListRow>>(apiUrl(`/api/meta/query/${objectCode}`), {
      method: "POST",
      body: controller.request,
      signal,
    }),
  );

  const { refreshSelectedRows } = controller;
  const onDataLoadedRef = useRef(onDataLoaded);
  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  });
  useEffect(() => {
    if (!query.data) return;
    refreshSelectedRows(query.data.list);
    onDataLoadedRef.current?.(query.data);
  }, [query.data, refreshSelectedRows]);

  /* ---------------- capabilities & permissions ---------------- */
  const canImport = (importable ?? config.capabilities.importable === true) && permissions.canObject(objectCode, "import");
  const canExport = (exportable ?? config.capabilities.exportable === true) && permissions.canObject(objectCode, "export");
  const canPrint = (printable ?? config.capabilities.printable === true) && permissions.canObject(objectCode, "print");
  const hasViews = config.capabilities.views === true;
  const canManageViews = hasViews && permissions.canObject(objectCode, "view_manage");

  /* ---------------- dialogs ---------------- */
  const [importOpen, setImportOpen] = useState(false);
  const [logType, setLogType] = useState<"IMPORT" | "EXPORT" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [printRows, setPrintRows] = useState<ListRow[] | null>(null);
  const [viewListOpen, setViewListOpen] = useState(false);
  const [viewEditor, setViewEditor] = useState<{ viewCode: string | null } | null>(null);
  const [deletingView, setDeletingView] = useState<Pick<ViewDef, "code" | "name"> | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const openPrint = useCallback((rows: ListRow[]) => {
    if (rows.length === 0) {
      toast.warning("请先勾选要打印的数据");
      return;
    }
    if (rows.length > PRINT_LIMIT) {
      toast.warning(printLimitMessage(config.objectName));
      return;
    }
    setPrintRows(rows);
  }, [config.objectName]);

  const { reload, clearSelection, selectedRows } = controller;
  const selectedRowsRef = useRef(selectedRows);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    selectedRowsRef.current = selectedRows;
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    onReadyRef.current?.({
      reload,
      reloadConfig: onReloadConfig,
      clearSelection,
      getSelectedRows: () => selectedRowsRef.current,
      openPrint,
      openImport: () => setImportOpen(true),
      openExport: () => setExportOpen(true),
    });
  }, [clearSelection, onReloadConfig, openPrint, reload]);


  /* ---------------- views ---------------- */
  const copyView = async (viewCode: string) => {
    try {
      const copied = await api.sendJson<ViewDef>(apiUrl(`/api/meta/views/${objectCode}/${viewCode}/copy`), { method: "POST" });
      toast.success(`已复制视图「${copied.name}」`);
      onReloadConfig();
    } catch (error) {
      toast.error(errorMessage(error, "复制视图失败"));
    }
  };

  const deleteView = async () => {
    if (!deletingView) return;
    setDeletePending(true);
    try {
      await api.sendJson(apiUrl(`/api/meta/views/${objectCode}/${deletingView.code}`), { method: "DELETE" });
      toast.success(`已删除视图「${deletingView.name}」`);
      const wasActive = deletingView.code === config.activeView?.code;
      setDeletingView(null);
      if (wasActive) {
        const fallback = config.views.find((view) => view.builtIn && view.code !== deletingView.code) ?? config.views.find((view) => view.code !== deletingView.code);
        if (fallback) onSwitchView(fallback.code);
        else onReloadConfig();
      } else {
        onReloadConfig();
      }
    } catch (error) {
      toast.error(errorMessage(error, "删除视图失败"));
    } finally {
      setDeletePending(false);
    }
  };

  /* ---------------- table ---------------- */
  const rows = useMemo(() => query.data?.list ?? [], [query.data]);
  const inlineCountOf = useCallback(
    (row: ListRow) => Math.max(0, typeof inlineActionCount === "function" ? inlineActionCount(row) : inlineActionCount),
    [inlineActionCount],
  );

  const { sorts, saveSorts } = controller;
  const quickSort = useCallback(
    (field: string, direction: SortSpec["direction"] | null) => {
      const rest = sorts.filter((sort) => sort.field !== field);
      void saveSorts(direction ? [{ field, direction }, ...rest] : rest).catch(reportPrefsError);
    },
    [saveSorts, sorts],
  );

  const gridColumns = useMemo<DataGridColumn<ListRow>[]>(() => {
    const columns: DataGridColumn<ListRow>[] = visibleColumns(controller.columns).map((state) => {
      const field = state.field;
      const renderer = cellRenderers?.[state.code];
      const isPrimary = state.code === config.primaryField;
      const rich = Boolean(renderer) || field.type === "IMAGE" || field.type === "ATTACHMENT" || field.type === "MULTI_SELECT";
      return {
        key: state.code,
        title: state.name,
        headerExtra: field.sortable ? (
          <HeaderSortButton
            name={state.name}
            direction={sorts.find((sort) => sort.field === state.code)?.direction ?? null}
            onChange={(direction) => quickSort(state.code, direction)}
          />
        ) : undefined,
        // Sortable columns reserve room for the quick-sort button beside the title.
        width: defaultColumnWidth({ ...field, width: state.width ?? field.width }, config.primaryField) + (field.sortable ? 24 : 0),
        fixed: state.fixed,
        align: field.type === "NUMBER" ? "right" : "left",
        ellipsis: !rich,
        tooltip: (row) => formatFieldValue(field, row[state.code], { plain: true }),
        render: (row) => {
          if (renderer) return renderer(row, { rowHeight: controller.rowHeight });
          if (isPrimary && onOpenRecord) {
            const text = formatFieldValue(field, row[state.code]);
            return (
              <TextButton className="max-w-full shrink" onClick={() => onOpenRecord(row)}>
                <span className="truncate">{text}</span>
              </TextButton>
            );
          }
          return (
            <FieldValue
              field={field}
              value={row[state.code]}
              status={state.code === config.statusField}
              rowHeight={controller.rowHeight}
            />
          );
        },
      };
    });
    if (rowActions) {
      const width =
        actionColumnWidth ??
        Math.min(
          360,
          rows.reduce((max, row) => Math.max(max, actionsWidth(rowActions(row), inlineCountOf(row))), 88),
        );
      columns.push({
        key: "__actions",
        title: "操作",
        width,
        fixed: "right",
        ellipsis: false,
        render: (row) => <RowActions actions={rowActions(row)} inlineCount={inlineCountOf(row)} />,
      });
    }
    return columns;
  }, [
    actionColumnWidth,
    cellRenderers,
    config.primaryField,
    config.statusField,
    controller.columns,
    controller.rowHeight,
    inlineCountOf,
    onOpenRecord,
    quickSort,
    rowActions,
    rows,
    sorts,
  ]);

  const sortFields = useMemo(() => {
    const sortable = controller.columns.filter((column) => column.sortable);
    return (sortable.length ? sortable : controller.columns).map((column) => ({ code: column.code, name: column.name }));
  }, [controller.columns]);

  /* ---------------- batch bar ---------------- */
  const selectionCount = controller.selectedKeys.length;
  const batchMode = selectable && selectionCount > 0;
  const batchList = useMemo<BatchAction[]>(() => {
    if (!batchMode) return [];
    const custom = batchActions?.(controller.selectedRows) ?? [];
    const hasPrint = custom.some((action) => action.key === "print" || action.key === "batchPrint");
    const list = canPrint && !hasPrint
      ? [{ key: "batchPrint", label: "批量打印", onClick: () => openPrint(controller.selectedRows) }, ...custom]
      : custom;
    return list.filter((action) => !action.hidden);
  }, [batchActions, batchMode, canPrint, controller.selectedRows, openPrint]);

  /* ---------------- search & filters ---------------- */
  const filterPanelId = useId();
  const searchFields = useMemo(() => splitSearchConditions(config.searchConditions), [config.searchConditions]);
  const keywordField = searchFields.keyword;
  const activeFilterCount = useMemo(() => {
    const panelCodes = new Set(searchFields.panel.map((field) => field.code));
    return new Set(controller.appliedFilters.filter((filter) => panelCodes.has(filter.field)).map((filter) => filter.field)).size;
  }, [controller.appliedFilters, searchFields.panel]);

  const groups = query.data?.groups;
  const groupField = config.groupingField;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {hasViews ? (
        <ViewTabs
          views={config.views}
          activeCode={config.activeView?.code}
          onSwitch={(code) => {
            if (code !== config.activeView?.code) onSwitchView(code);
          }}
          onEdit={(code) => setViewEditor({ viewCode: code })}
          onCopy={(code) => void copyView(code)}
          onDelete={(view) => setDeletingView(view)}
          onOpenList={() => setViewListOpen(true)}
          manageable={canManageViews}
        />
      ) : null}

      {groupField ? (
        <CapsuleGroup<string | number>
          aria-label={`按${groupField.name}分组`}
          items={(groups?.length ? groups : [{ value: "__ALL__", label: "全部", count: query.data?.total ?? 0 }]).map((group) => ({
            key: group.value,
            label: group.label,
            count: group.count,
          }))}
          value={controller.groupValue ?? "__ALL__"}
          onChange={(key) => {
            controller.setGroupValue(key === "__ALL__" ? null : key);
            controller.clearSelection();
          }}
        />
      ) : null}

      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3" role="toolbar" aria-label="列表工具栏">
        {topTabs?.length ? (
          <ListScopeSwitch
            className="lg:flex-1"
            items={topTabs}
            value={topTab}
            onChange={(key) => {
              setTopTab(key);
              controller.clearSelection();
              controller.setPage(1);
              onTopTabChange?.(key);
            }}
          />
        ) : null}

        {batchMode ? (
          <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:shrink-0 lg:justify-end" role="group" aria-label="批量操作">
            <span className="mr-1 text-sm text-text-secondary">
              已选 <span className="font-medium text-brand tabular-nums">{selectionCount}</span> 项
            </span>
            {batchList.map((action) => {
              const button = (
                <Button
                  key={action.key}
                  variant="outline"
                  icon={action.icon}
                  disabled={action.disabled}
                  className={cn(action.danger && "border-danger text-danger hover:border-[#ff7875] hover:text-[#ff7875]")}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              );
              return action.disabled && action.disabledReason ? (
                <Tooltip key={action.key} title={action.disabledReason}>
                  <span className="inline-flex">{button}</span>
                </Tooltip>
              ) : (
                button
              );
            })}
            <Button variant="ghost" icon={<X />} onClick={controller.clearSelection}>
              取消选择
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:shrink-0 lg:flex-nowrap lg:justify-end">
            {keywordField ? (
              <ListSearchBox
                className="w-full sm:w-60 lg:w-56 xl:w-64"
                field={keywordField}
                value={controller.draft[keywordField.code]}
                onChange={(next) => controller.setDraftValue(keywordField.code, next)}
                onSearch={controller.applySearch}
              />
            ) : null}
            {searchFields.panel.length ? (
              <ListFilterButton
                open={controller.expanded}
                activeCount={activeFilterCount}
                controls={filterPanelId}
                onToggle={() => controller.setExpanded(!controller.expanded)}
              />
            ) : null}
            {toolbarFilters}
            {canImport ? (
              <SplitButton
                icon={<FileInput />}
                onClick={() => setImportOpen(true)}
                menuItems={[{ key: "importLog", label: "导入日志", onClick: () => setLogType("IMPORT") }]}
              >
                导入
              </SplitButton>
            ) : null}
            {canExport ? (
              <SplitButton
                icon={<FileOutput />}
                onClick={() => setExportOpen(true)}
                menuItems={[{ key: "exportLog", label: "导出日志", onClick: () => setLogType("EXPORT") }]}
              >
                导出
              </SplitButton>
            ) : null}
            {toolbarExtra}
            <div className="flex items-center gap-1 sm:ml-auto lg:ml-0 lg:border-l lg:border-border lg:pl-2" role="group" aria-label="表格设置">
              <FieldConfigPopover
                compact
                states={controller.columnStates}
                primaryField={config.primaryField}
                onChange={(states) => void controller.saveColumns(states).catch(reportPrefsError)}
              />
              <SortPopover
                compact
                key={`${config.activeView?.code ?? ""}`}
                fields={sortFields}
                value={controller.sorts}
                onChange={(sorts) => void controller.saveSorts(sorts).catch(reportPrefsError)}
              />
              <RowHeightMenu compact value={controller.rowHeight} onChange={(next) => void controller.saveRowHeight(next).catch(reportPrefsError)} />
            </div>
          </div>
        )}
      </div>

      {searchFields.panel.length > 0 ? (
        <div hidden={!controller.expanded}>
          <ListFilterPanel
            id={filterPanelId}
            fields={searchFields.panel}
            values={controller.draft}
            onValueChange={controller.setDraftValue}
            onSearch={controller.applySearch}
            onReset={controller.resetSearch}
            loading={query.isLoading && query.data !== null}
          />
        </div>
      ) : null}

      {toolbarNote ? <div className="text-sm text-muted-foreground">{toolbarNote}</div> : null}

      <AsyncView result={query} isEmpty={() => false}>
        {(data) => (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            {query.error ? (
              <div role="alert" className="rounded-[4px] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                刷新失败：{query.error.message}
              </div>
            ) : null}
            <DataGrid<ListRow>
              aria-label={`${config.objectName}列表`}
              columns={gridColumns}
              rows={data.list}
              rowKey={(row) => String(row.id)}
              rowHeight={controller.rowHeight}
              loading={query.isLoading}
              indexOffset={(data.page.current - 1) * data.page.pageSize}
              fillViewport={{ bottomGap: 76, minHeight: 280 }}
              tree={
                treeRows
                  ? {
                      ...treeRows,
                      resetKey: controller.requestKey,
                      onLoadError: (error) => toast.error(errorMessage(error, "加载子级数据失败")),
                    }
                  : undefined
              }
              selection={
                selectable
                  ? {
                      mode: "multiple",
                      selectedKeys: controller.selectedKeys,
                      onChange: controller.onSelectionChange,
                    }
                  : undefined
              }
            />
            <Pagination
              className="mt-auto"
              total={data.total}
              totalCapped={data.totalCapped}
              current={controller.page}
              pageSize={controller.pageSize}
              onChange={(page, pageSize) => {
                if (pageSize !== controller.pageSize) controller.setPageSize(pageSize);
                else controller.setPage(page);
              }}
            />
          </div>
        )}
      </AsyncView>

      {canImport ? (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          objectCode={objectCode}
          objectName={config.objectName}
          onImported={(result) => {
            if (result.succeeded > 0) controller.reload();
          }}
          onOpenLog={() => setLogType("IMPORT")}
        />
      ) : null}
      {canExport ? (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          objectCode={objectCode}
          objectName={config.objectName}
          request={controller.request}
          fieldCodes={visibleColumns(controller.columns).map((state) => state.code)}
          total={query.data?.total ?? 0}
          selectedIds={controller.selectedKeys}
          onOpenLog={() => setLogType("EXPORT")}
        />
      ) : null}
      <ExcelLogModal
        open={logType !== null}
        onOpenChange={(open) => {
          if (!open) setLogType(null);
        }}
        type={logType ?? "IMPORT"}
        objectCode={objectCode}
        objectName={config.objectName}
      />
      {canPrint ? (
        <PrintDialog
          open={printRows !== null}
          onOpenChange={(open) => {
            if (!open) setPrintRows(null);
          }}
          objectCode={objectCode}
          ids={(printRows ?? []).map((row) => String(row.id))}
        />
      ) : null}
      {hasViews ? (
        <>
          <ViewListDrawer
            open={viewListOpen}
            onOpenChange={setViewListOpen}
            objectCode={objectCode}
            activeCode={config.activeView?.code}
            onCreate={() => setViewEditor({ viewCode: null })}
            onEdit={(code) => setViewEditor({ viewCode: code })}
            onCopy={(code) => void copyView(code)}
            onDelete={(view) => setDeletingView(view)}
            onChanged={onReloadConfig}
            refreshKey={config.views.map((view) => view.code).join(",")}
          />
          <ViewEditorDrawer
            open={viewEditor !== null}
            onOpenChange={(open) => {
              if (!open) setViewEditor(null);
            }}
            objectCode={objectCode}
            viewCode={viewEditor?.viewCode ?? null}
            onSaved={(view, created) => {
              setViewEditor(null);
              if (created) onSwitchView(view.code);
              else onReloadConfig();
            }}
          />
          <ConfirmDialog
            open={deletingView !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingView(null);
            }}
            title="删除视图"
            description={`是否确认删除视图「${deletingView?.name ?? ""}」？删除后使用该视图的用户将回到「全部」视图，删除后不可恢复。`}
            confirmLabel="删除"
            destructive
            pending={deletePending}
            onConfirm={deleteView}
          />
        </>
      ) : null}
    </div>
  );
}

export function MetaListPage(props: MetaListPageProps) {
  const api = useKitApi();
  const permissions = usePermissions();
  const { objectCode, title, headerExtra, back, createLabel = "创建", onCreate, className } = props;
  const canCreate = Boolean(onCreate) && permissions.canObject(objectCode, "create");
  const [viewCode, setViewCode] = useState<string | undefined>(undefined);
  const [configToken, setConfigToken] = useState(0);

  const config = useRequest(`meta-config:${objectCode}:${viewCode ?? ""}:${configToken}`, (signal) =>
    api.getJson<EffectivePageConfig>(
      apiUrl(`/api/meta/config/${objectCode}`) + (viewCode ? `?view=${encodeURIComponent(viewCode)}` : ""),
      { signal },
    ),
  );

  const switchView = useCallback(
    (code: string) => {
      setViewCode(code);
      void api.sendJson(apiUrl(`/api/meta/active-view/${objectCode}`), { method: "PUT", body: { viewCode: code } }).catch(
        (error: unknown) => toast.error(errorMessage(error, "切换视图失败")),
      );
    },
    [api, objectCode],
  );

  const reloadConfig = useCallback(() => setConfigToken((token) => token + 1), []);

  return (
    <PageContainer
      title={title}
      back={back}
      extra={
        headerExtra || canCreate ? (
          <>
            {headerExtra}
            {canCreate ? (
              <Button variant="primary" icon={<CirclePlus />} onClick={onCreate}>
                {createLabel}
              </Button>
            ) : null}
          </>
        ) : undefined
      }
      fill
      className={className}
    >
      <AsyncView result={config} isEmpty={() => false}>
        {(data) => (
          <MetaListBody
            key={`${data.objectCode}:${data.activeView?.code ?? "default"}:${data.activeView?.updatedAt ?? ""}`}
            {...props}
            config={data}
            onSwitchView={switchView}
            onReloadConfig={reloadConfig}
          />
        )}
      </AsyncView>
    </PageContainer>
  );
}
