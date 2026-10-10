"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ReferencePicker — 对象参照弹窗 (121 客户 / 125 物料参照): title = object name,
 * the referenced object's search conditions (expandable), 字段配置 / 行高,
 * table with radio (single) or checkbox (multiple) selection kept across
 * pages, pagination, 「已选 N 项」, 取消 / 选择.
 *
 * Objects whose status field is `enabled` only list enabled records.
 */
import { useMemo } from "react";
import { AsyncView } from "@/components/data/async-view";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { resolveFieldIconKind } from "@/components/kit/ui/field-icons";
import { FieldTypeIcon } from "@/components/kit/ui/field-type-icon";
import { Pagination } from "@/components/kit/ui/pagination";

import { useRequest } from "@/lib/hooks";
import { isRefValue } from "@/lib/component-kit/format";

import { toRefValue } from "@/lib/component-kit/form-model";
import { defaultColumnWidth, visibleColumns } from "@/lib/component-kit/list-columns";
import { useListController, type ListRow } from "@/lib/component-kit/use-list-controller";
import type { EffectivePageConfig, FieldDef, QueryFilter, QueryResult, RefValue } from "@/lib/component-kit/types";
import {  } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { FieldConfigPopover } from "@/components/kit/meta/field-config-popover";
import { FieldValue } from "@/components/kit/meta/field-value";
import { RowHeightMenu } from "@/components/kit/meta/row-height-menu";
import { SearchPanel } from "@/components/kit/meta/search-panel";

export interface ReferencePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Referenced objectCode (product, customer, supplier, process…). */
  objectCode: string;
  /** Dialog title; defaults to the object name. */
  title?: string;
  multiple?: boolean;
  /** Currently selected records (回显). */
  value?: RefValue | RefValue[] | null;
  /** Always-on filters (e.g. only 自制 materials). */
  fixedFilters?: QueryFilter[];
  /** `widget.params` of the relation field → EQ filters. */
  params?: Record<string, unknown>;
  /** Field whose reference spec builds the RefValue labels. */
  field?: Pick<FieldDef, "reference">;
  isRowSelectable?: (row: ListRow) => boolean;
  confirmText?: string;
  /** Picked full rows plus their RefValue snapshots (same order). */
  onConfirm: (rows: ListRow[], refs: RefValue[]) => void;
}

function toRows(value: ReferencePickerProps["value"]): ListRow[] {
  const refs = Array.isArray(value) ? value.filter(isRefValue) : isRefValue(value) ? [value] : [];
  return refs.map((ref) => ({ id: ref.id, name: ref.name, code: ref.code ?? null, __echo: true }));
}

function PickerList({
  objectCode,
  config,
  multiple,
  value,
  fixedFilters,
  params,
  field,
  isRowSelectable,
  confirmText,
  onCancel,
  onConfirm,
}: Omit<ReferencePickerProps, "open" | "onOpenChange" | "title"> & {
  config: EffectivePageConfig;
  onCancel: () => void;
}) {
  const api = useKitApi();
  const filters = useMemo<QueryFilter[]>(() => {
    const list: QueryFilter[] = [...(fixedFilters ?? [])];
    for (const [code, expected] of Object.entries(params ?? {})) {
      if (expected === undefined || expected === null || expected === "") continue;
      list.push({ field: code, operator: Array.isArray(expected) ? "IN" : "EQ", value: expected });
    }
    if (config.statusField === "enabled" && !list.some((item) => item.field === "enabled")) {
      list.push({ field: "enabled", operator: "EQ", value: "1" });
    }
    return list;
  }, [config.statusField, fixedFilters, params]);

  const controller = useListController({
    objectCode,
    config,
    fixedFilters: filters,
    persistPrefs: false,
    initialSelection: toRows(value),
  });

  const query = useRequest(controller.requestKey, (signal) =>
    api.sendJson<QueryResult<ListRow>>(apiUrl(`/api/meta/query/${objectCode}`), {
      method: "POST",
      body: controller.request,
      signal,
    }),
  );

  const columns = useMemo<DataGridColumn<ListRow>[]>(
    () =>
      visibleColumns(controller.columns).map((state) => ({
        key: state.code,
        title: state.name,
        headerIcon: <FieldTypeIcon kind={resolveFieldIconKind(state.field, config.primaryField)} />,
        width: defaultColumnWidth({ ...state.field, width: state.width ?? state.field.width }, config.primaryField),
        fixed: state.fixed,
        align: state.field.type === "NUMBER" ? "right" : "left",
        tooltip: (row) => (typeof row[state.code] === "string" ? (row[state.code] as string) : undefined),
        render: (row) => (
          <FieldValue
            field={state.field}
            value={row[state.code]}
            status={state.code === config.statusField}
            rowHeight={controller.rowHeight}
          />
        ),
      })),
    [config.primaryField, config.statusField, controller.columns, controller.rowHeight],
  );

  const confirm = (rows: ListRow[]) => {
    onConfirm(
      rows,
      rows.map((row) =>
        row.__echo ? { id: row.id, name: String(row.name ?? ""), code: (row.code as string | null) ?? null } : toRefValue(row, field ?? {}),
      ),
    );
  };

  const selectRow = (row: ListRow) => {
    if (isRowSelectable && !isRowSelectable(row)) return;
    const key = String(row.id);
    if (!multiple) {
      controller.onSelectionChange([key], { rows: [row], checked: true });
      return;
    }
    const checked = !controller.selectedKeys.includes(key);
    controller.onSelectionChange(
      checked ? [...controller.selectedKeys, key] : controller.selectedKeys.filter((item) => item !== key),
      { rows: [row], checked },
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchPanel
        compact
        collapsedCount={2}
        conditions={config.searchConditions}
        values={controller.draft}
        onValueChange={controller.setDraftValue}
        onSearch={controller.applySearch}
        onReset={controller.resetSearch}
        expanded={controller.expanded}
        onExpandedChange={controller.setExpanded}
        loading={query.isLoading && query.data !== null}
      />
      <div className="flex items-center gap-4">
        <FieldConfigPopover
          states={controller.columnStates}
          primaryField={config.primaryField}
          onChange={(states) => void controller.saveColumns(states)}
        />
        <RowHeightMenu value={controller.rowHeight} onChange={(next) => void controller.saveRowHeight(next)} />
      </div>
      <AsyncView result={query} isEmpty={() => false}>
        {(data) => (
          <div className="flex min-w-0 flex-col gap-3">
            <DataGrid<ListRow>
              aria-label={`${config.objectName}参照`}
              columns={columns}
              rows={data.list}
              rowKey={(row) => String(row.id)}
              rowHeight={controller.rowHeight}
              indexOffset={(data.page.current - 1) * data.page.pageSize}
              loading={query.isLoading}
              maxHeight="min(50vh, 460px)"
              selection={{
                mode: multiple ? "multiple" : "single",
                selectedKeys: controller.selectedKeys,
                onChange: controller.onSelectionChange,
                isRowSelectable,
              }}
              onRowClick={selectRow}
              rowProps={(row) => ({
                onDoubleClick: () => {
                  if (multiple || (isRowSelectable && !isRowSelectable(row))) return;
                  confirm([row]);
                },
              })}
            />
            <Pagination
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-secondary pt-3">
        <span className="text-sm text-text-secondary">
          {multiple ? (
            <>
              已选 <span className="font-medium text-brand">{controller.selectedKeys.length}</span> 项
            </>
          ) : null}
        </span>
        <span className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!multiple && controller.selectedKeys.length === 0}
            onClick={() => confirm(controller.selectedRows)}
          >
            {confirmText ?? "选择"}
          </Button>
        </span>
      </div>
    </div>
  );
}

function PickerBody(props: Omit<ReferencePickerProps, "open" | "onOpenChange" | "title"> & { onCancel: () => void }) {
  const api = useKitApi();
  const config = useRequest(`meta-config:${props.objectCode}`, (signal) =>
    api.getJson<EffectivePageConfig>(apiUrl(`/api/meta/config/${props.objectCode}`), { signal }),
  );
  return (
    <AsyncView result={config} isEmpty={() => false}>
      {(data) => <PickerList {...props} config={data} />}
    </AsyncView>
  );
}



export function ReferencePicker({ open, onOpenChange, title, objectCode, onConfirm, ...rest }: ReferencePickerProps) {
  const resolvedTitle = title ?? "选择数据";
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={resolvedTitle} size="xl" contentClassName="px-4 py-4 sm:px-6 sm:py-5">
      {open ? (
        <PickerBody
          key={objectCode}
          {...rest}
          objectCode={objectCode}
          onCancel={() => onOpenChange(false)}
          onConfirm={(rows, refs) => {
            onConfirm(rows, refs);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
