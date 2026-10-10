"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * MetaListPage — the generic 灵动 list page (01 §5): page title + headerExtra,
 * 顶部胶囊页签 (topTabs), 视图页签, 二级分组胶囊, 查询区, 工具栏 (创建 / 导入⋮导入日志 /
 * 导出⋮导出日志 / toolbarExtra / 字段配置 / 排序 / 行高), 勾选批量栏, table
 * (勾选、序号、类型图标、主字段链接、按类型渲染、操作列 + ⋯ 悬停菜单), 分页.
 *
 * Everything is driven by GET /api/meta/config/$objectCode and
 * POST /api/meta/query/$objectCode. Pages add business behaviour through
 * props: onCreate, rowActions, batchActions, onOpenRecord, cellRenderers…
 */
import { CirclePlus, FileInput, FileOutput, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SplitButton, TextButton } from "@/components/kit/ui/buttons";
import { PageCard, PageContainer } from "@/components/kit/shell/page-layout";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { resolveFieldIconKind } from "@/components/kit/ui/field-icons";
import { FieldTypeIcon } from "@/components/kit/ui/field-type-icon";
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
import { SearchPanel } from "@/components/kit/meta/search-panel";
import { SortPopover } from "@/components/kit/meta/sort-popover";
import type { BatchAction, MetaListApi, RowAction, TopTab } from "@/components/kit/meta/types";
import { ViewEditorDrawer } from "@/components/kit/meta/view-editor-drawer";
import { ViewListDrawer } from "@/components/kit/meta/view-list-drawer";
import { ViewTabs } from "@/components/kit/meta/view-tabs";

export interface MetaListPageProps {
  objectCode: string;
  /** Page title (卡片外左上). */
  title: ReactNode;
  /** Links on the right of the title row (移动端卡片、自定义事件…). */
  headerExtra?: ReactNode;
  /** Primary toolbar button text (default 创建). Hidden without `onCreate`. */
  createLabel?: string;
  onCreate?: () => void;
  /** Extra toolbar buttons after 导出 (批量新增、默认单位…). */
  toolbarExtra?: ReactNode;
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
   * 树形列表（父子工单）: ▸/▾ before `indentColumn` (default: first column); children are
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
  const textWidth = inline.reduce((sum, action) => sum + action.label.length * 14, 0);
  const gaps = Math.max(0, inline.length - 1) * 12;
  const more = visible.length > inlineCount ? 36 : 0;
  return Math.max(72, textWidth + gaps + more + 28);
}

interface BodyProps extends MetaListPageProps {
  config: EffectivePageConfig;
  onSwitchView: (viewCode: string) => void;
  onReloadConfig: () => void;
}

function MetaListBody({
  objectCode,
  config,
  onSwitchView,
  onReloadConfig,
  createLabel = "创建",
  onCreate,
  toolbarExtra,
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
  const canCreate = Boolean(onCreate) && permissions.canObject(objectCode, "create");
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

  const reportPrefsError = (error: unknown) => toast.error(errorMessage(error, "个人偏好保存失败"));

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

  const gridColumns = useMemo<DataGridColumn<ListRow>[]>(() => {
    const columns: DataGridColumn<ListRow>[] = visibleColumns(controller.columns).map((state) => {
      const field = state.field;
      const renderer = cellRenderers?.[state.code];
      const isPrimary = state.code === config.primaryField;
      const rich = Boolean(renderer) || field.type === "IMAGE" || field.type === "ATTACHMENT" || field.type === "MULTI_SELECT";
      return {
        key: state.code,
        title: state.name,
        headerIcon: <FieldTypeIcon kind={resolveFieldIconKind(field, config.primaryField)} />,
        width: defaultColumnWidth({ ...field, width: state.width ?? field.width }, config.primaryField),
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
    rowActions,
    rows,
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

  const groups = query.data?.groups;
  const groupField = config.groupingField;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {topTabs?.length ? (
        <CapsuleGroup<string>
          aria-label="数据范围"
          items={topTabs.map((tab) => ({ key: tab.key, label: tab.label }))}
          value={topTab}
          onChange={(key) => {
            setTopTab(key);
            controller.clearSelection();
            controller.setPage(1);
            onTopTabChange?.(key);
          }}
        />
      ) : null}

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

      <SearchPanel
        conditions={config.searchConditions}
        values={controller.draft}
        onValueChange={controller.setDraftValue}
        onSearch={controller.applySearch}
        onReset={controller.resetSearch}
        expanded={controller.expanded}
        onExpandedChange={controller.setExpanded}
        loading={query.isLoading && query.data !== null}
      />

      {batchMode ? (
        <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-2" role="toolbar" aria-label="批量操作">
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
          <Button variant="outline" icon={<Undo2 />} className="ml-auto" onClick={controller.clearSelection}>
            撤销多选
          </Button>
        </div>
      ) : (
        <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-2" role="toolbar" aria-label="列表工具栏">
          {canCreate ? (
            <Button variant="primary" icon={<CirclePlus />} onClick={onCreate}>
              {createLabel}
            </Button>
          ) : null}
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
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-1">
            <FieldConfigPopover
              states={controller.columnStates}
              primaryField={config.primaryField}
              onChange={(states) => void controller.saveColumns(states).catch(reportPrefsError)}
            />
            <SortPopover
              key={`${config.activeView?.code ?? ""}`}
              fields={sortFields}
              value={controller.sorts}
              onChange={(sorts) => void controller.saveSorts(sorts).catch(reportPrefsError)}
            />
            <RowHeightMenu value={controller.rowHeight} onChange={(next) => void controller.saveRowHeight(next).catch(reportPrefsError)} />
          </span>
        </div>
      )}

      <AsyncView result={query} isEmpty={() => false}>
        {(data) => (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            {query.error ? (
              <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
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
  const { objectCode, title, headerExtra, className } = props;
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
    <PageContainer title={title} extra={headerExtra} fill className={className}>
      <PageCard fill>
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
      </PageCard>
    </PageContainer>
  );
}
