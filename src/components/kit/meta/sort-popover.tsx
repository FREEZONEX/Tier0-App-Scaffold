"use client";

/**
 * 排序: 「设置排序条件」, rows of drag handle +
 * 字段下拉 + A → Z / Z → A + ×, 「＋ 添加排序条件」; the toolbar button shows the
 * condition count. Complete conditions are reported on every change.
 *
 * `SortConditionList` is shared with the view editor's 默认排序 tab.
 */
import { ArrowDownUp, GripVertical, Plus, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { Popover } from "@/components/kit/ui/popover";
import { Segmented } from "@/components/kit/ui/segmented";
import { Select } from "@/components/kit/ui/select";
import { moveItem } from "@/lib/component-kit/list-columns";
import type { FieldDef, SortSpec } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

interface DraftSort {
  key: string;
  field: string | null;
  direction: "asc" | "desc";
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
            "flex min-w-0 items-center gap-2 rounded-md bg-[#f5f7fa] px-2 py-1.5",
            dragIndex === index && "opacity-40",
          )}
        >
          <GripVertical className="size-3.5 shrink-0 cursor-grab text-text-placeholder" aria-hidden="true" />
          <Select<string>
            aria-label="排序字段"
            className="min-w-0 flex-1"
            showSearch
            placeholder="请选择字段"
            value={draft.field}
            options={fields.map((field) => ({
              value: field.code,
              label: field.name,
              disabled: used.has(field.code) && field.code !== draft.field,
            }))}
            onChange={(next) => commit(drafts.map((item) => (item.key === draft.key ? { ...item, field: next } : item)))}
          />
          <Segmented<"asc" | "desc">
            aria-label="排序方向"
            className="shrink-0"
            value={draft.direction}
            options={[
              { value: "asc", label: "A → Z" },
              { value: "desc", label: "Z → A" },
            ]}
            onChange={(next) => commit(drafts.map((item) => (item.key === draft.key ? { ...item, direction: next } : item)))}
          />
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
}

/** Toolbar「排序」 text button with count badge + popover. */
export function SortPopover({ fields, value, onChange, disabled = false }: SortPopoverProps) {
  return (
    <Popover
      placement="bottom-start"
      aria-label="设置排序条件"
      disabled={disabled}
      className="w-[min(480px,calc(100vw-24px))] p-4"
      content={
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-foreground">设置排序条件</span>
          <SortConditionList fields={fields} value={value} onChange={onChange} />
        </div>
      }
    >
      <TextButton icon={<ArrowDownUp />} disabled={disabled}>
        {value.length > 0 ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[11px] leading-4 text-white tabular-nums">
            {value.length}
          </span>
        ) : null}
        排序
      </TextButton>
    </Popover>
  );
}
