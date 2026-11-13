"use client";

/**
 * 排序: 「设置排序条件」, rows of drag handle +
 * 字段下拉 + 升序 / 降序 + ×, 「＋ 添加排序条件」. The toolbar button names the
 * first rule (「排序：计划数量 降序」, 「+N」 for more; hover lists all), so the
 * current order is readable without opening the panel. Complete conditions
 * are reported on every change; a row without a field is kept only while the
 * panel is open.
 *
 * `SortConditionList` is shared with the view editor's 默认排序 tab.
 */
import { ArrowDownUp, ArrowUp, ArrowDown, GripVertical, Plus, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { Popover } from "@/components/kit/ui/popover";
import { Segmented } from "@/components/kit/ui/segmented";
import { Select } from "@/components/kit/ui/select";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { moveItem } from "@/lib/component-kit/list-columns";
import type { FieldDef, SortSpec } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

interface DraftSort {
  key: string;
  field: string | null;
  direction: "asc" | "desc";
}

/** Direction names used by the panel, the toolbar summary and its tooltip. */
export const SORT_DIRECTION_LABEL = { asc: "升序", desc: "降序" } as const;

type SortField = Pick<FieldDef, "code" | "name">;

/** 「计划数量 降序」; an unknown field falls back to its code so a rule is never blank. */
export function describeSort(sort: SortSpec, fields: readonly SortField[]): string {
  const name = fields.find((field) => field.code === sort.field)?.name || sort.field;
  return `${name} ${SORT_DIRECTION_LABEL[sort.direction]}`;
}

function toDrafts(sorts: readonly SortSpec[]): DraftSort[] {
  return sorts.map((sort, index) => ({ key: `initial-${index}`, field: sort.field, direction: sort.direction }));
}

function toSorts(drafts: readonly DraftSort[]): SortSpec[] {
  return drafts
    .filter((draft): draft is DraftSort & { field: string } => Boolean(draft.field))
    .map((draft) => ({ field: draft.field, direction: draft.direction }));
}

export interface SortConditionListProps {
  /** Candidate fields (sortable columns). */
  fields: readonly Pick<FieldDef, "code" | "name">[];
  value: readonly SortSpec[];
  onChange: (sorts: SortSpec[]) => void;
  className?: string;
}

export function SortConditionList({ fields, value, onChange, className }: SortConditionListProps) {
  const [drafts, setDrafts] = useState<DraftSort[]>(() => toDrafts(value));
  const valueKey = JSON.stringify(value.map(({ field, direction }) => ({ field, direction })));
  const [previousValueKey, setPreviousValueKey] = useState(valueKey);
  if (previousValueKey !== valueKey) {
    setPreviousValueKey(valueKey);
    if (JSON.stringify(toSorts(drafts)) !== valueKey) setDrafts(toDrafts(value));
  }
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const seedRef = useRef(0);

  const commit = (next: DraftSort[]) => {
    setDrafts(next);
    onChange(toSorts(next));
  };

  const used = new Set(drafts.map((draft) => draft.field).filter(Boolean));

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {drafts.map((draft, index) => (
        <div
          key={draft.key}
          draggable
          onDragStart={(event: DragEvent<HTMLDivElement>) => {
            setDragIndex(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
          }}
          onDragOver={(event) => {
            if (dragIndex !== null) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex !== null && dragIndex !== index) commit(moveItem(drafts, dragIndex, index));
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2 rounded-[4px] bg-muted px-2 py-1.5",
            dragIndex === index && "opacity-40",
          )}
        >
          <GripVertical className="size-3.5 shrink-0 cursor-grab text-text-placeholder" aria-hidden="true" />
          <Select<string>
            aria-label="排序字段"
            className="min-w-[140px] flex-1"
            showSearch
            placeholder="请选择字段"
            value={draft.field}
            options={[
              ...fields.map((field) => ({
                value: field.code,
                label: field.name,
                disabled: used.has(field.code) && field.code !== draft.field,
              })),
              // A saved rule on a field that is no longer offered stays readable and removable.
              ...(draft.field && !fields.some((field) => field.code === draft.field)
                ? [{ value: draft.field, label: draft.field }]
                : []),
            ]}
            onChange={(next) => commit(drafts.map((item) => (item.key === draft.key ? { ...item, field: next } : item)))}
          />
          <Segmented<"asc" | "desc">
            aria-label="排序方向"
            className="shrink-0"
            value={draft.direction}
            options={[
              { value: "asc", label: SORT_DIRECTION_LABEL.asc },
              { value: "desc", label: SORT_DIRECTION_LABEL.desc },
            ]}
            onChange={(next) => commit(drafts.map((item) => (item.key === draft.key ? { ...item, direction: next } : item)))}
          />
          <IconButton size="sm" label="上移排序条件" icon={<ArrowUp />} disabled={index === 0}
            onClick={() => commit(moveItem(drafts, index, index - 1))} />
          <IconButton size="sm" label="下移排序条件" icon={<ArrowDown />} disabled={index === drafts.length - 1}
            onClick={() => commit(moveItem(drafts, index, index + 1))} />
          <IconButton
            size="sm"
            label="删除排序条件"
            icon={<X />}
            onClick={() => commit(drafts.filter((item) => item.key !== draft.key))}
          />
        </div>
      ))}
      <div>
        <TextButton
          icon={<Plus />}
          disabled={drafts.length >= fields.length}
          onClick={() => {
            seedRef.current += 1;
            const key = `added-${seedRef.current}`;
            setDrafts((current) => [...current, { key, field: null, direction: "asc" }]);
          }}
        >
          添加排序条件
        </TextButton>
      </div>
    </div>
  );
}

export interface SortPopoverProps {
  fields: readonly Pick<FieldDef, "code" | "name">[];
  value: readonly SortSpec[];
  onChange: (sorts: SortSpec[]) => void;
  disabled?: boolean;
  /** The rules are the view's 默认排序; the button adds 「（默认）」. */
  isDefault?: boolean;
}

/** Toolbar「排序」 text button naming the active rules + popover. */
export function SortPopover({ fields, value, onChange, disabled = false, isDefault = false }: SortPopoverProps) {
  const rules = value.map((sort) => describeSort(sort, fields));
  const trigger = (
    <TextButton
      icon={<ArrowDownUp />}
      disabled={disabled}
      aria-label={rules.length ? `排序：${rules.join("，")}${isDefault ? "（默认）" : ""}` : "排序"}
      className="max-w-[min(18rem,100%)]"
    >
      <span className="min-w-0 truncate">{rules.length > 0 ? `排序：${rules[0]}` : "排序"}</span>
      {rules.length > 0 && isDefault ? <span className="shrink-0 text-muted-foreground">（默认）</span> : null}
      {rules.length > 0 ? (
        <>
          {rules.length > 1 ? (
            <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] bg-muted px-1 text-[11px] leading-4 text-muted-foreground tabular-nums">
              +{rules.length - 1}
            </span>
          ) : null}
        </>
      ) : null}
    </TextButton>
  );
  return (
    <Popover
      placement="bottom-start"
      aria-label="设置排序条件"
      disabled={disabled}
      className="w-[min(480px,calc(100vw-24px))] p-4"
      anchorClassName="inline-flex min-w-0 max-w-full"
      content={
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-foreground">设置排序条件</span>
          <SortConditionList fields={fields} value={value} onChange={onChange} />
        </div>
      }
    >
      <Tooltip
        title={rules.length ? (
          <ol className="m-0 list-none p-0">
            {rules.map((rule, index) => (
              <li key={value[index].field}>{rules.length > 1 ? `${index + 1}. ` : ""}{rule}</li>
            ))}
          </ol>
        ) : null}
        anchorClassName="inline-flex min-w-0 max-w-full"
      >
        {trigger}
      </Tooltip>
    </Popover>
  );
}
