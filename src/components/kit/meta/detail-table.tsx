"use client";

/**
 * DetailTable — 可编辑明细表: controlled rows; columns from the table
 * section items; primary button 选择 XX (reference picker, multi) or 增行;
 * toolbarExtra slot; 批量修改 (checked rows only) / 批量删除; drag handle
 * reorder; inline editing by field type; 复制 / 删除 per row; column header
 * 批量填充; 合计行; read-only mode; row-level error highlighting; 字段配置 /
 * 行高 (local); horizontal scroll with a right-fixed 操作 column.
 *
 * Rows added here get a `__key`; strip it with `stripRowKeys()` before saving.
 */
import { BriefcaseMedical, CirclePlus, CircleQuestionMark, GripVertical, PenLine, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { resolveFieldIconKind } from "@/components/kit/ui/field-icons";
import { FieldTypeIcon } from "@/components/kit/ui/field-type-icon";
import { Popover } from "@/components/kit/ui/popover";
import { Select } from "@/components/kit/ui/select";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { formatNumber, numberOptionsOf } from "@/lib/component-kit/format";
import {
  applyFillRules,
  buildDefaultRow,
  isDerivedField,
  isFieldReadonly,
  sumColumn,
  type FormMode,
  type FormValues,
  type RowError,
} from "@/lib/component-kit/form-model";
import { columnStatesFrom, defaultColumnWidth, type ColumnState } from "@/lib/component-kit/list-columns";
import type { FieldDef, QueryFilter, RefValue, RowHeight, SelectOption } from "@/lib/component-kit/types";
import type { ListRow } from "@/lib/component-kit/use-list-controller";
import { cn } from "@/lib/utils";
import { FieldConfigPopover } from "@/components/kit/meta/field-config-popover";
import { FieldControl } from "@/components/kit/meta/field-control";
import { FieldValue } from "@/components/kit/meta/field-value";
import { ReferencePicker } from "@/components/kit/meta/reference-picker";
import { RowHeightMenu } from "@/components/kit/meta/row-height-menu";
import type { RowAction } from "@/components/kit/meta/types";

export interface DetailPickerConfig {
  /** Referenced objectCode (product, process…). */
  objectCode: string;
  /** Dialog title (default: object name). */
  title?: string;
  /** Button text (default 「选择」+ picker title). */
  label?: string;
  fixedFilters?: QueryFilter[];
  /** Build a new detail row from a picked record. */
  toRow: (record: ListRow, ref: RefValue) => FormValues;
  /** Id of the picked record a row was built from; those records cannot be picked again. */
  uniqueBy?: (row: FormValues) => string | null | undefined;
}

export interface DetailCellContext {
  row: FormValues;
  index: number;
  field: FieldDef;
  value: unknown;
  readonly: boolean;
  error?: string;
  /** Update this cell (applies fillRules when records are given). */
  onChange: (value: unknown, records?: Record<string, unknown>[]) => void;
  /** Patch several fields of this row. */
  patchRow: (patch: FormValues) => void;
}

export interface DetailTableProps {
  /** Columns (table section items, custom fields included). */
  items: readonly FieldDef[];
  rows: readonly FormValues[];
  onChange: (rows: FormValues[]) => void;
  mode?: FormMode;
  /** Detail objectCode (custom select 「允许用户添加选项」). */
  objectCode?: string;
  /** 增行 button text, or the picker button text when `picker` is set. */
  addLabel?: string;
  /** Hide the primary add button. */
  hideAdd?: boolean;
  /** New row factory for 增行 (default: widget defaults). Return null to cancel. */
  createRow?: () => FormValues | null;
  /** 选择 XX: pick records to add rows. */
  picker?: DetailPickerConfig;
  /** Extra toolbar buttons (按 BOM 添加…). */
  toolbarExtra?: ReactNode;
  /** 批量修改 / 批量删除 (default true). */
  batchEdit?: boolean;
  batchDelete?: boolean;
  /** Replace the default 复制 / 删除 row actions. */
  rowActions?: (row: FormValues, index: number) => RowAction[];
  /** view mode: still render the `rowActions` column (callers disable the buttons, 查看记录「分配 / 删除」灰显). */
  showActionsInView?: boolean;
  /** Replace the 序号 cell content (the drag handle stays), e.g. tree numbers 1 / 1.1 / 1.2. */
  renderIndex?: (row: FormValues, index: number) => ReactNode;
  /** 序号 column width (default 64). */
  indexWidth?: number;
  copyable?: boolean;
  deletable?: boolean | ((row: FormValues, index: number) => boolean);
  /** Confirm / veto before rows are removed (e.g. rows that already created work orders). */
  onBeforeDelete?: (rows: FormValues[]) => boolean | Promise<boolean>;
  draggable?: boolean;
  /** Columns with a 批量填充 header button ("auto" = editable select / relation / date columns). */
  fillableFields?: readonly string[] | "auto";
  /** Columns summed in the 合计 row. */
  summaryFields?: readonly string[];
  errors?: readonly RowError[];
  /** Cell overrides keyed by field code. */
  renderCell?: Record<string, (context: DetailCellContext) => ReactNode>;
  /** Linked updates: receives the row after a cell change and returns the final row. */
  onRowChange?: (row: FormValues, change: { code: string; value: unknown; records?: Record<string, unknown>[]; index: number }) => FormValues;
  columnWidths?: Record<string, number>;
  /** Column codes never shown (kept in data). */
  hiddenColumns?: readonly string[];
  /** 字段配置 + 行高 in the toolbar (default true). */
  columnSettings?: boolean;
  maxHeight?: number | string;
  className?: string;
  "aria-label"?: string;
}

function rowKeyOf(row: FormValues, index: number): string {
  const key = row.__key ?? row.id;
  return key === undefined || key === null || key === "" ? `row-${index}` : String(key);
}

function newKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isFillable(field: FieldDef): boolean {
  return field.type === "SINGLE_SELECT" || field.type === "RELATION_OBJECT" || field.type === "DATETIME";
}

function BatchFillPopover({
  field,
  objectCode,
  onApply,
}: {
  field: FieldDef;
  objectCode?: string;
  onApply: (value: unknown, records?: Record<string, unknown>[]) => void;
}) {
  const [value, setValue] = useState<unknown>(undefined);
  const [records, setRecords] = useState<Record<string, unknown>[] | undefined>(undefined);
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(undefined);
          setRecords(undefined);
        }
      }}
      placement="bottom"
      className="w-72 p-4"
      aria-label={`批量填充${field.name}`}
      content={({ close }) => (
        <div className="flex flex-col gap-3">
          <div className="relative flex min-h-6 items-center justify-center gap-1 px-7 text-base font-semibold">
            批量填充
            <Tooltip title="批量填充后会覆盖该列所有值">
              <CircleQuestionMark className="size-3.5 text-text-tertiary" aria-label="批量填充后会覆盖该列所有值" />
            </Tooltip>
            <IconButton size="sm" label="关闭批量填充" tooltip={false} icon={<X />} className="absolute right-0 top-0" onClick={close} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">{field.name}：</span>
            <FieldControl
              field={{ ...field, widget: { ...field.widget, readonly: false } }}
              value={value}
              objectCode={objectCode}
              onChange={(next, picked) => {
                setValue(next);
                setRecords(picked);
              }}
            />
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={close}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onApply(value, records);
                close();
              }}
            >
              确认
            </Button>
          </div>
        </div>
      )}
    >
      <IconButton size="sm" label={`批量填充${field.name}`} tooltip={false} icon={<BriefcaseMedical />} className="size-5" />
    </Popover>
  );
}

function BatchEditDialog({
  open,
  onOpenChange,
  fields,
  count,
  objectCode,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FieldDef[];
  count: number;
  objectCode?: string;
  onApply: (code: string, value: unknown, records?: Record<string, unknown>[]) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [value, setValue] = useState<unknown>(undefined);
  const [records, setRecords] = useState<Record<string, unknown>[] | undefined>(undefined);
  const field = fields.find((item) => item.code === code);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCode(null);
          setValue(undefined);
        }
        onOpenChange(next);
      }}
      title="批量修改"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!field}
            onClick={() => {
              if (!field) return;
              onApply(field.code, value, records);
              setCode(null);
              setValue(undefined);
              onOpenChange(false);
            }}
          >
            确定
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-[#e7f9b9] px-3 py-2 text-sm text-[#050b14]">
          提示：批量修改仅作用于当前已勾选的 {count} 条明细，其他明细不受影响。
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">修改字段</span>
          <Select<string>
            aria-label="修改字段"
            showSearch
            placeholder="请选择要修改的字段"
            value={code}
            options={fields.map((item) => ({ value: item.code, label: item.name }))}
            onChange={(next) => {
              setCode(next);
              setValue(undefined);
              setRecords(undefined);
            }}
          />
        </div>
        {field ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm">修改为</span>
            <FieldControl
              field={field}
              value={value}
              objectCode={objectCode}
              onChange={(next, picked) => {
                setValue(next);
                setRecords(picked);
              }}
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

export function DetailTable({
  items,
  rows,
  onChange,
  mode = "create",
  objectCode,
  addLabel,
  hideAdd = false,
  createRow,
  picker,
  toolbarExtra,
  batchEdit = true,
  batchDelete = true,
  rowActions,
  showActionsInView = false,
  renderIndex,
  indexWidth,
  copyable = true,
  deletable = true,
  onBeforeDelete,
  draggable = true,
  fillableFields = "auto",
  summaryFields,
  errors,
  renderCell,
  onRowChange,
  columnWidths,
  hiddenColumns,
  columnSettings = true,
  maxHeight,
  className,
  "aria-label": ariaLabel,
}: DetailTableProps) {
  const readOnly = mode === "view";
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [rowHeight, setRowHeight] = useState<RowHeight>("MID");
  const [columnStates, setColumnStates] = useState<ColumnState[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The handlers read the ref: dragover can arrive before the dragstart render.
  const dragIndexRef = useRef<number | null>(null);
  const [extraOptions, setExtraOptions] = useState<Record<string, SelectOption[]>>({});

  const visibleItems = useMemo(
    () => items.filter((field) => field.widget?.visible !== false && !hiddenColumns?.includes(field.code)),
    [hiddenColumns, items],
  );

  const baseStates = useMemo(() => columnStatesFrom(visibleItems.map((field) => ({ ...field, fixed: null }))), [visibleItems]);
  const states = useMemo(() => {
    if (!columnStates) return baseStates;
    const known = new Map(columnStates.map((state) => [state.code, state]));
    const merged = columnStates.filter((state) => baseStates.some((base) => base.code === state.code));
    for (const base of baseStates) if (!known.has(base.code)) merged.push(base);
    return merged;
  }, [baseStates, columnStates]);

  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const error of errors ?? []) {
      const key = `${error.rowIndex}:${error.field}`;
      if (!map.has(key)) map.set(key, error.message);
    }
    return map;
  }, [errors]);

  const keys = rows.map(rowKeyOf);
  const selectedRows = rows.filter((row, index) => selectedKeys.includes(keys[index]));

  /* ---------------- mutations ---------------- */
  const updateRow = (index: number, code: string, value: unknown, records?: Record<string, unknown>[]) => {
    const field = items.find((item) => item.code === code);
    let next: FormValues = { ...rows[index], [code]: value };
    if (field?.type === "RELATION_OBJECT") {
      const record = records?.[0] ?? (value === null || value === undefined || (Array.isArray(value) && value.length === 0) ? null : undefined);
      if (record !== undefined) next = applyFillRules(field, record, next);
    }
    if (onRowChange) next = onRowChange(next, { code, value, records, index });
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? next : row)));
  };

  const patchRow = (index: number, patch: FormValues) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    const created = createRow ? createRow() : buildDefaultRow(items);
    if (!created) return;
    onChange([...rows, { __key: newKey(), ...created }]);
  };

  const removeRows = async (targets: FormValues[]) => {
    if (targets.length === 0) return;
    if (onBeforeDelete && !(await onBeforeDelete(targets))) return;
    const removing = new Set(targets);
    onChange(rows.filter((row) => !removing.has(row)));
    const removedKeys = new Set(targets.map((row) => rowKeyOf(row, rows.indexOf(row))));
    setSelectedKeys((current) => current.filter((key) => !removedKeys.has(key)));
  };

  const copyRow = (index: number) => {
    const source = rows[index];
    const { id: _id, __key: _key, ...rest } = source;
    const copy: FormValues = { ...rest, __key: newKey() };
    onChange([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]);
  };

  const fillColumn = (code: string, value: unknown, records?: Record<string, unknown>[]) => {
    const field = items.find((item) => item.code === code);
    onChange(
      rows.map((row, index) => {
        let next: FormValues = { ...row, [code]: value };
        if (field?.type === "RELATION_OBJECT") {
          const cleared = value === null || value === undefined || (Array.isArray(value) && value.length === 0);
          if (records?.[0]) next = applyFillRules(field, records[0], next);
          else if (cleared) next = applyFillRules(field, null, next);
        }
        return onRowChange ? onRowChange(next, { code, value, records, index }) : next;
      }),
    );
  };

  const batchApply = (code: string, value: unknown, records?: Record<string, unknown>[]) => {
    const field = items.find((item) => item.code === code);
    const selected = new Set(selectedKeys);
    onChange(
      rows.map((row, index) => {
        if (!selected.has(keys[index])) return row;
        let next: FormValues = { ...row, [code]: value };
        if (field?.type === "RELATION_OBJECT" && records?.[0]) next = applyFillRules(field, records[0], next);
        return onRowChange ? onRowChange(next, { code, value, records, index }) : next;
      }),
    );
  };

  const moveRow = (from: number, to: number) => {
    if (from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  /* ---------------- picker ---------------- */
  const existingPicked = useMemo(() => {
    if (!picker?.uniqueBy) return new Set<string>();
    return new Set(rows.map((row) => picker.uniqueBy?.(row)).filter((key): key is string => Boolean(key)));
  }, [picker, rows]);

  const pickerLabel = addLabel ?? picker?.label ?? (picker ? `选择${picker.title ?? "数据"}` : "增行");

  /* ---------------- columns ---------------- */
  const editableFields = visibleItems.filter((field) => !isFieldReadonly(field, mode) && !isDerivedField(field));
  const fillable = new Set(
    fillableFields === "auto"
      ? editableFields.filter(isFillable).map((field) => field.code)
      : fillableFields.filter((code) => editableFields.some((field) => field.code === code)),
  );

  const columns: DataGridColumn<FormValues>[] = states
    .filter((state) => !state.hidden)
    .map((state) => {
      const field = state.field;
      const readonly = readOnly || isFieldReadonly(field, mode) || isDerivedField(field);
      const custom = renderCell?.[field.code];
      return {
        key: field.code,
        title: field.name,
        headerTip: field.widget?.tooltip || undefined,
        headerIcon: <FieldTypeIcon kind={resolveFieldIconKind(field)} />,
        required: Boolean(field.widget?.required) && !readOnly,
        headerExtra:
          !readOnly && rows.length > 0 && fillable.has(field.code) ? (
            <BatchFillPopover field={field} objectCode={objectCode} onApply={(value, records) => fillColumn(field.code, value, records)} />
          ) : undefined,
        width:
          columnWidths?.[field.code] ??
          Math.max(
            defaultColumnWidth(field),
            readonly ? 100 : field.type !== "DATETIME" ? 150 : field.widget?.displayPrecision === "DATE" ? 170 : 200,
          ),
        align: field.type === "NUMBER" && readonly ? "right" : "left",
        ellipsis: readonly && !custom && field.type !== "IMAGE" && field.type !== "ATTACHMENT",
        render: (row, index) => {
          const error = errorMap.get(`${index}:${field.code}`);
          if (custom) {
            return custom({
              row,
              index,
              field,
              value: row[field.code],
              readonly,
              error,
              onChange: (value, records) => updateRow(index, field.code, value, records),
              patchRow: (patch) => patchRow(index, patch),
            });
          }
          if (readonly) {
            return <FieldValue field={field} value={row[field.code]} rowHeight={rowHeight} />;
          }
          const control = (
            <FieldControl
              field={field}
              value={row[field.code]}
              compact
              mode={mode}
              objectCode={objectCode}
              status={error ? "error" : undefined}
              extraOptions={extraOptions[field.code]}
              onOptionAdded={(option) =>
                setExtraOptions((current) => ({ ...current, [field.code]: [...(current[field.code] ?? []), option] }))
              }
              className="w-full"
              onChange={(value, records) => updateRow(index, field.code, value, records)}
            />
          );
          return error ? (
            <Tooltip title={error} anchorClassName="flex w-full min-w-0">
              {control}
            </Tooltip>
          ) : (
            control
          );
        },
      };
    });

  const showActions = readOnly
    ? showActionsInView && Boolean(rowActions)
    : Boolean(rowActions) || copyable || deletable !== false;
  if (showActions) {
    columns.push({
      key: "__actions",
      title: "操作",
      fixed: "right",
      width: rowActions ? 140 : 108,
      ellipsis: false,
      render: (row, index) => {
        const actions: RowAction[] = rowActions
          ? rowActions(row, index)
          : [
              ...(copyable ? [{ key: "copy", label: "复制", onClick: () => copyRow(index) }] : []),
              ...((typeof deletable === "function" ? deletable(row, index) : deletable)
                ? [{ key: "delete", label: "删除", danger: true, onClick: () => void removeRows([row]) }]
                : []),
            ];
        return (
          <span className="flex items-center gap-3" data-grid-no-row-click="">
            {actions
              .filter((action) => !action.hidden)
              .map((action) => (
                <TextButton
                  key={action.key}
                  tone={action.danger ? "danger" : action.tone ?? "primary"}
                  disabled={action.disabled}
                  title={action.disabled ? action.disabledReason : undefined}
                  onClick={action.onClick}
                >
                  {action.label}
                </TextButton>
              ))}
          </span>
        );
      },
    });
  }

  const summary = summaryFields?.length
    ? Object.fromEntries(
        summaryFields.map((code) => {
          const field = items.find((item) => item.code === code);
          return [code, formatNumber(sumColumn(rows, code), numberOptionsOf(field?.widget))];
        }),
      )
    : null;

  const canDrag = draggable && !readOnly;
  const errorsList = errors ?? [];

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 [contain:inline-size]", className)}>
      {!readOnly || columnSettings ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2" role="toolbar" aria-label="明细操作">
          {!readOnly && !hideAdd ? (
            <Button variant="primary" icon={<CirclePlus />} onClick={picker ? () => setPickerOpen(true) : addRow}>
              {pickerLabel}
            </Button>
          ) : null}
          {!readOnly ? toolbarExtra : null}
          {!readOnly && batchEdit ? (
            <Button variant="outline" icon={<PenLine />} disabled={selectedRows.length === 0} onClick={() => setBatchEditOpen(true)}>
              批量修改
            </Button>
          ) : null}
          {!readOnly && batchDelete ? (
            <Button variant="outline" icon={<Trash2 />} disabled={selectedRows.length === 0} onClick={() => setConfirmDelete(true)}>
              批量删除
            </Button>
          ) : null}
          {columnSettings ? (
            <span className="flex items-center gap-4 pl-1">
              <FieldConfigPopover states={states} onChange={(next) => setColumnStates(next)} />
              <RowHeightMenu value={rowHeight} onChange={setRowHeight} />
            </span>
          ) : null}
          {!readOnly && selectedRows.length > 0 ? (
            <span className="ml-auto text-sm text-text-secondary">
              已选 <span className="font-medium text-brand">{selectedRows.length}</span> 项
            </span>
          ) : null}
        </div>
      ) : null}

      {errorsList.length > 0 ? (
        <div role="alert" className="rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-danger">
          {errorsList.slice(0, 3).map((error) => error.message).join("；")}
          {errorsList.length > 3 ? `；等 ${errorsList.length} 处需要修改` : ""}
        </div>
      ) : null}

      <DataGrid<FormValues>
        aria-label={ariaLabel ?? "明细"}
        columns={columns}
        rows={rows}
        rowKey={rowKeyOf}
        rowHeight={rowHeight}
        maxHeight={maxHeight}
        summary={summary}
        selection={
          !readOnly && (batchEdit || batchDelete)
            ? { mode: "multiple", selectedKeys, onChange: (next) => setSelectedKeys(next) }
            : undefined
        }
        indexWidth={indexWidth}
        renderIndex={(row, index) => (
          <span className="inline-flex max-w-full items-center gap-1">
            {canDrag ? <GripVertical className="size-3.5 shrink-0 cursor-grab text-text-placeholder" aria-hidden="true" /> : null}
            {renderIndex ? (
              <span className="min-w-0 truncate tabular-nums">{renderIndex(row, index)}</span>
            ) : (
              <span className="tabular-nums">{index + 1}</span>
            )}
          </span>
        )}
        rowProps={
          canDrag
            ? (_row, index) => ({
                draggable: true,
                onDragStart: (event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("input, textarea, [role='combobox']")) {
                    event.preventDefault();
                    return;
                  }
                  dragIndexRef.current = index;
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                },
                onDragOver: (event) => {
                  if (dragIndexRef.current === null) return;
                  event.preventDefault();
                  if (dropIndex !== index) setDropIndex(index);
                },
                onDrop: (event) => {
                  event.preventDefault();
                  const from = dragIndexRef.current;
                  dragIndexRef.current = null;
                  if (from !== null) moveRow(from, index);
                  setDragIndex(null);
                  setDropIndex(null);
                },
                onDragEnd: () => {
                  dragIndexRef.current = null;
                  setDragIndex(null);
                  setDropIndex(null);
                },
                className: cn(
                  dragIndex === index && "opacity-40",
                  dropIndex === index && dragIndex !== null && dragIndex !== index && "[&>td]:border-t-2 [&>td]:border-t-brand",
                ),
              })
            : undefined
        }
      />

      {picker ? (
        <ReferencePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          objectCode={picker.objectCode}
          title={picker.title}
          multiple
          fixedFilters={picker.fixedFilters}
          isRowSelectable={
            picker.uniqueBy
              ? (record) => !existingPicked.has(String(record.id))
              : undefined
          }
          confirmText="选择"
          onConfirm={(records, refs) => {
            const added = records.map((record, index) => ({ __key: newKey(), ...buildDefaultRow(items), ...picker.toRow(record, refs[index]) }));
            onChange([...rows, ...added]);
          }}
        />
      ) : null}
      {!readOnly && batchEdit ? (
        <BatchEditDialog
          open={batchEditOpen}
          onOpenChange={setBatchEditOpen}
          fields={editableFields}
          count={selectedRows.length}
          objectCode={objectCode}
          onApply={batchApply}
        />
      ) : null}
      {!readOnly && batchDelete ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="批量删除"
          description={`是否确认批量删除选中数据? 将删除已勾选的 ${selectedRows.length} 条明细。`}
          confirmLabel="删除"
          destructive
          onConfirm={async () => {
            await removeRows(selectedRows);
            setConfirmDelete(false);
          }}
        />
      ) : null}
    </div>
  );
}
