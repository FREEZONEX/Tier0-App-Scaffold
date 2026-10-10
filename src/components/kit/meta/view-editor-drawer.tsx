"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ViewEditorDrawer — 创建视图 / 编辑视图 (234–238, 268): left tabs
 * 基本信息（名称、图标 5 色、二级分组、行高、使用范围）/ 字段权限（开关、全部打开 /
 * 全部关闭）/ 字段配置（顺序、显隐、固定、全部显示 / 全部隐藏）/ 数据过滤（条件行、
 * 动态日期）/ 默认排序; footer 取消 / 确定.
 *
 * Data: GET /api/meta/view-options/$objectCode, GET /api/meta/views/$objectCode;
 * saves with POST /api/meta/views/$objectCode or PUT …/$viewCode.
 */
import { ArrowDownAZ, Funnel, LayoutList, Rows3, SquarePen } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { FieldLabel } from "@/components/forms/field-label";
import { Drawer } from "@/components/overlays/drawer";
import { Button } from "@/components/ui/button";
import { resolveFieldIconKind } from "@/components/kit/ui/field-icons";
import { FieldTypeIcon } from "@/components/kit/ui/field-type-icon";
import { Input } from "@/components/kit/ui/input";
import { RadioGroup } from "@/components/kit/ui/radio";
import { Select } from "@/components/kit/ui/select";
import { Switch } from "@/components/kit/ui/switch";
import { errorMessage } from "@/lib/component-kit/api-client";
import { useRequest } from "@/lib/hooks";
import {
  applyColumnPrefs,
  columnStatesFrom,
  ROW_HEIGHT_OPTIONS,
  toColumnPrefs,
  type ColumnState,
} from "@/lib/component-kit/list-columns";
import { withViewTimeFilterFirst } from "@/lib/component-kit/query-model";
import type {
  ColumnPref,
  QueryFilter,
  RowHeight,
  SortSpec,
  ViewDef,
  ViewEditorOptions,
  ViewIcon as ViewIconName,
  ViewScope,
} from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { ColumnConfigList } from "@/components/kit/meta/field-config-popover";
import { FilterConditionList } from "@/components/kit/meta/filter-condition-list";
import { SortConditionList } from "@/components/kit/meta/sort-popover";
import { ViewIcon } from "@/components/kit/meta/view-icon";
import { isEmptyViewScope, ViewScopeSelect } from "@/components/kit/meta/view-scope-select";

export interface ViewEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectCode: string;
  /** null = 创建视图. */
  viewCode: string | null;
  onSaved: (view: ViewDef, created: boolean) => void;
}

type TabKey = "basic" | "permission" | "columns" | "filters" | "sorts";

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: "basic", label: "基本信息", icon: <SquarePen /> },
  { key: "permission", label: "字段权限", icon: <Rows3 /> },
  { key: "columns", label: "字段配置", icon: <LayoutList /> },
  { key: "filters", label: "数据过滤", icon: <Funnel /> },
  { key: "sorts", label: "默认排序", icon: <ArrowDownAZ /> },
];

const ICONS: ViewIconName[] = ["dark", "green", "blue", "orange", "red"];

interface ViewDraft {
  name: string;
  icon: ViewIconName;
  groupingField: string | null;
  rowHeight: RowHeight;
  scope: ViewScope;
  visibleFields: string[] | null;
  columns: Record<string, ColumnPref>;
  filters: QueryFilter[];
  sorts: SortSpec[];
}

/** Name limit shared with the server (VIEW_NAME_MAX). */
const VIEW_NAME_MAX = 20;

function draftFrom(view: ViewDef | null, options: ViewEditorOptions): ViewDraft {
  // First 数据过滤 row = the object's time field (创建时间, or 申请时间 for 入库单 / 出库单).
  const filters = withViewTimeFilterFirst(view?.filters ?? [], options.filterCandidates);
  if (!view) {
    return {
      name: "",
      icon: "dark",
      groupingField: null,
      rowHeight: "MID",
      scope: { all: true },
      visibleFields: null,
      columns: {},
      filters,
      sorts: [],
    };
  }
  return {
    name: view.name,
    icon: view.icon ?? "dark",
    groupingField: view.groupingField,
    rowHeight: view.rowHeight ?? "MID",
    scope: view.scope ?? { all: true },
    visibleFields: view.visibleFields,
    columns: view.columns ?? {},
    filters,
    sorts: view.sorts ?? [],
  };
}

function Section({ title, description, extra, children }: { title: string; description?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-xs text-text-tertiary">{description}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function EditorForm({
  objectCode,
  view,
  options,
  onCancel,
  onSaved,
}: {
  objectCode: string;
  view: ViewDef | null;
  options: ViewEditorOptions;
  onCancel: () => void;
  onSaved: (view: ViewDef, created: boolean) => void;
}) {
  const api = useKitApi();
  const [tab, setTab] = useState<TabKey>("basic");
  const [draft, setDraft] = useState<ViewDraft>(() => draftFrom(view, options));
  const [nameError, setNameError] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState(false);
  const [saving, setSaving] = useState(false);

  const permitted = useMemo(
    () => (draft.visibleFields === null ? options.columnCandidates : options.columnCandidates.filter((field) => draft.visibleFields?.includes(field.code))),
    [draft.visibleFields, options.columnCandidates],
  );
  const columnStates = useMemo<ColumnState[]>(() => columnStatesFrom(applyColumnPrefs(permitted, draft.columns)), [draft.columns, permitted]);

  const patch = (next: Partial<ViewDraft>) => setDraft((current) => ({ ...current, ...next }));

  const setPermission = (code: string, on: boolean) => {
    const all = options.columnCandidates.map((field) => field.code);
    const current = draft.visibleFields ?? all;
    const next = on ? [...new Set([...current, code])] : current.filter((item) => item !== code);
    patch({ visibleFields: next.length === all.length ? null : all.filter((item) => next.includes(item)) });
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) {
      setNameError("请输入视图名称");
      setTab("basic");
      return;
    }
    setNameError(null);
    if (isEmptyViewScope(draft.scope)) {
      setScopeError(true);
      toast.error("请选择使用范围");
      setTab("basic");
      return;
    }
    const scope: ViewScope = draft.scope.all
      ? { all: true }
      : {
          all: false,
          ...(draft.scope.mine ? { mine: true } : {}),
          personIds: draft.scope.personIds ?? [],
          departmentIds: draft.scope.departmentIds ?? [],
        };
    const body: Partial<ViewDef> = {
      name,
      icon: draft.icon,
      groupingField: draft.groupingField,
      rowHeight: draft.rowHeight,
      scope,
      visibleFields: draft.visibleFields,
      columns: draft.columns,
      filters: draft.filters,
      sorts: draft.sorts,
    };
    setSaving(true);
    try {
      const saved = view
        ? await api.sendJson<ViewDef>(apiUrl(`/api/meta/views/${objectCode}/${view.code}`), { method: "PUT", body })
        : await api.sendJson<ViewDef>(apiUrl(`/api/meta/views/${objectCode}`), { method: "POST", body });
      toast.success(view ? `视图「${saved.name}」已保存` : `视图「${saved.name}」已创建`);
      onSaved(saved, !view);
    } catch (error) {
      toast.error(errorMessage(error, "保存视图失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
        <nav
          aria-label="视图设置"
          className="scrollbar-none flex shrink-0 overflow-x-auto border-b border-border-secondary bg-[#fafbfc] sm:w-36 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 sm:py-2"
        >
          {TABS.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-current={tab === item.key ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm transition-colors [&_svg]:size-4",
                tab === item.key
                  ? "bg-brand-soft font-medium text-brand sm:after:absolute sm:after:inset-y-2 sm:after:right-0 sm:after:w-0.5 sm:after:bg-brand"
                  : "text-foreground hover:text-brand",
              )}
              onClick={() => setTab(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="page-y-scroll min-h-0 min-w-0 flex-1 px-4 py-4 sm:px-6">
          {tab === "basic" ? (
            <Section title="基本信息">
              <div className="grid max-w-xl gap-4">
                <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
                  <FieldLabel required htmlFor="view-name" className="flex-row-reverse font-normal sm:justify-end">
                    视图名称：
                  </FieldLabel>
                  <div>
                    <Input
                      id="view-name"
                      value={draft.name}
                      maxLength={VIEW_NAME_MAX}
                      status={nameError ? "error" : undefined}
                      placeholder="请输入视图名称"
                      onChange={(next) => {
                        patch({ name: next });
                        if (next.trim()) setNameError(null);
                      }}
                    />
                    {nameError ? (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        {nameError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm text-foreground sm:text-right">图标：</span>
                  <div className="flex items-center gap-3" role="radiogroup" aria-label="视图图标">
                    {ICONS.map((icon) => (
                      <button
                        type="button"
                        key={icon}
                        role="radio"
                        aria-checked={draft.icon === icon}
                        aria-label={`图标 ${icon}`}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md border transition-colors",
                          draft.icon === icon ? "border-brand bg-brand-soft" : "border-transparent hover:bg-fill-hover",
                        )}
                        onClick={() => patch({ icon })}
                      >
                        <ViewIcon icon={icon} size={18} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm text-foreground sm:text-right">二级分组：</span>
                  <Select<string>
                    aria-label="二级分组"
                    allowClear
                    placeholder="不分组"
                    value={draft.groupingField}
                    options={options.groupingCandidates.map((field) => ({ value: field.code, label: field.name }))}
                    onChange={(code) => patch({ groupingField: code ?? null })}
                  />
                </div>
                <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm text-foreground sm:text-right">行高：</span>
                  <RadioGroup<string>
                    aria-label="行高"
                    optionType="button"
                    buttonStyle="solid"
                    value={draft.rowHeight}
                    options={ROW_HEIGHT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    onChange={(next) => patch({ rowHeight: next as RowHeight })}
                  />
                </div>
                <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-start">
                  <span className="text-sm text-foreground sm:pt-1.5 sm:text-right">使用范围：</span>
                  <div className="min-w-0">
                    <ViewScopeSelect
                      value={draft.scope}
                      status={scopeError ? "error" : undefined}
                      onChange={(scope) => {
                        patch({ scope });
                        if (!isEmptyViewScope(scope)) setScopeError(false);
                      }}
                    />
                    {scopeError ? (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        请选择使用范围
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Section>
          ) : null}

          {tab === "permission" ? (
            <Section
              title="字段权限"
              description="设置此视图下用户在列表最多查看的字段"
              extra={
                <span className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => patch({ visibleFields: null })}>
                    全部打开
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => patch({ visibleFields: [] })}>
                    全部关闭
                  </Button>
                </span>
              }
            >
              <ul className="grid gap-1">
                {options.columnCandidates.map((field) => {
                  const on = draft.visibleFields === null || draft.visibleFields.includes(field.code);
                  return (
                    <li key={field.code} className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1.5 hover:bg-fill-hover">
                      <Switch size="sm" aria-label={`${field.name}可见`} checked={on} onChange={(next) => setPermission(field.code, next)} />
                      <FieldTypeIcon kind={resolveFieldIconKind(field)} />
                      <span className="truncate text-sm">{field.name}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          {tab === "columns" ? (
            <Section
              title="字段配置"
              description="设置此视图下字段的顺序、显隐和固定"
              extra={
                <span className="flex items-center gap-2">
                  <span className="mr-2 text-xs tabular-nums text-text-tertiary">
                    {columnStates.filter((state) => !state.hidden).length}/{columnStates.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => patch({ columns: toColumnPrefs(columnStates.map((state) => ({ ...state, hidden: false }))) })}
                  >
                    全部显示
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patch({
                        columns: toColumnPrefs(columnStates.map((state, index) => ({ ...state, hidden: index !== 0 }))),
                      })
                    }
                  >
                    全部隐藏
                  </Button>
                </span>
              }
            >
              {columnStates.length ? (
                <ColumnConfigList
                  states={columnStates}
                  maxHeight="none"
                  onChange={(states) => patch({ columns: toColumnPrefs(states) })}
                />
              ) : (
                <p className="text-sm text-text-tertiary">字段权限全部关闭时没有可配置的字段</p>
              )}
            </Section>
          ) : null}

          {tab === "filters" ? (
            <Section title="数据过滤" description="只显示满足全部条件的数据">
              <FilterConditionList
                fields={options.filterCandidates}
                value={draft.filters}
                lockFirst
                onChange={(filters) => patch({ filters })}
              />
            </Section>
          ) : null}

          {tab === "sorts" ? (
            <Section title="默认排序" description="用户未设置个人排序时按此排序">
              <SortConditionList
                fields={options.sortCandidates}
                value={draft.sorts}
                onChange={(sorts) => patch({ sorts })}
              />
            </Section>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border-secondary px-4 py-3 sm:px-6">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          确定
        </Button>
      </div>
    </div>
  );
}

function ViewEditorBody({ objectCode, viewCode, onCancel, onSaved }: { objectCode: string; viewCode: string | null; onCancel: () => void; onSaved: ViewEditorDrawerProps["onSaved"] }) {
  const api = useKitApi();
  const options = useRequest(`meta-view-options:${objectCode}`, (signal) =>
    api.getJson<ViewEditorOptions>(apiUrl(`/api/meta/view-options/${objectCode}`), { signal }),
  );
  const views = useRequest(
    `meta-views-edit:${objectCode}:${viewCode ?? ""}`,
    (signal) => api.getJson<ViewDef[]>(apiUrl(`/api/meta/views/${objectCode}`), { signal }),
    { enabled: viewCode !== null },
  );
  return (
    <AsyncView result={options} isEmpty={() => false}>
      {(editorOptions) =>
        viewCode === null ? (
          <EditorForm objectCode={objectCode} view={null} options={editorOptions} onCancel={onCancel} onSaved={onSaved} />
        ) : (
          <AsyncView result={views} isEmpty={(list) => !list.some((view) => view.code === viewCode)} empty={<p className="p-6 text-sm text-text-tertiary">视图不存在或已被删除</p>}>
            {(list) => (
              <EditorForm
                objectCode={objectCode}
                view={list.find((view) => view.code === viewCode) ?? null}
                options={editorOptions}
                onCancel={onCancel}
                onSaved={onSaved}
              />
            )}
          </AsyncView>
        )
      }
    </AsyncView>
  );
}

export function ViewEditorDrawer({ open, onOpenChange, objectCode, viewCode, onSaved }: ViewEditorDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={viewCode === null ? "创建视图" : "编辑视图"}
      size="lg"
      className="sm:max-w-[52rem]"
      contentClassName="flex flex-col p-0 sm:p-0"
    >
      {open ? (
        <ViewEditorBody
          key={viewCode ?? "__create"}
          objectCode={objectCode}
          viewCode={viewCode}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      ) : null}
    </Drawer>
  );
}
