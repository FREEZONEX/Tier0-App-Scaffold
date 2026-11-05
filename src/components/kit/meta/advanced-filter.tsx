"use client";

/**
 * AdvancedFilter — 高级筛选（多条件组合筛选）. One control per field
 * (编码、名称、负责人、日期范围 …, by field type via SearchPanel). 查询 applies
 * the filled conditions together with AND; empty conditions do not take part.
 * Applied conditions show as tags under the panel: closing one removes only
 * that condition, 清空条件 removes all of them.
 *
 * All conditions stay visible and wrap by the container's width (container
 * queries), so it also fits a narrow card or drawer; show / hide the whole
 * panel from a host button (「高级筛选」).
 *
 * The component is controlled by the APPLIED values (`value` / `onChange`);
 * typing edits a draft until 查询. Filter rows with `filterListRows` from
 * `@/lib/component-kit/list-search`. For a single box matched against several
 * fields use KeywordSearch (关键词搜索); on one list the two combine with AND.
 */
import { useState } from "react";
import { TextButton } from "@/components/kit/ui/buttons";
import { Tag } from "@/components/kit/ui/tag";
import { SearchPanel } from "@/components/kit/meta/search-panel";
import { describeCondition } from "@/lib/component-kit/list-search";
import { emptySearchValue, type SearchValues } from "@/lib/component-kit/query-model";
import type { FieldDef } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface ActiveConditionTagsProps {
  conditions: readonly FieldDef[];
  /** Applied values. */
  value: SearchValues;
  onChange: (value: SearchValues) => void;
  className?: string;
}

/** Applied 高级筛选 conditions as closable tags; renders nothing when none is filled. */
export function ActiveConditionTags({ conditions, value, onChange, className }: ActiveConditionTagsProps) {
  const active = conditions
    .map((field) => ({ field, text: describeCondition(field, value[field.code]) }))
    .filter((entry): entry is { field: FieldDef; text: string } => entry.text !== null);
  if (!active.length) return null;
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)} aria-label="已应用的筛选条件">
      {active.map(({ field, text }) => (
        <Tag
          key={field.code}
          closable
          onClose={() => onChange({ ...value, [field.code]: emptySearchValue(field) })}
        >
          {text}
        </Tag>
      ))}
      <TextButton size="sm" onClick={() => onChange(Object.fromEntries(conditions.map((field) => [field.code, emptySearchValue(field)])))}>
        清空条件
      </TextButton>
    </div>
  );
}

export interface AdvancedFilterProps {
  /** One condition per field; the control follows the field type. */
  conditions: readonly FieldDef[];
  /** Applied values — what the list is filtered by. */
  value: SearchValues;
  onChange: (value: SearchValues) => void;
  /** Narrow containers (drawers, dialogs): fewer conditions per row. */
  compact?: boolean;
  className?: string;
}

export function AdvancedFilter({
  conditions,
  value,
  onChange,
  compact = false,
  className,
}: AdvancedFilterProps) {
  const [draft, setDraft] = useState<SearchValues>(value);
  const [applied, setApplied] = useState<SearchValues>(value);
  // Applied values changed outside (a tag closed, 清除筛选): mirror them into the draft.
  if (applied !== value) {
    setApplied(value);
    setDraft(value);
  }

  const cleared = () => Object.fromEntries(conditions.map((field) => [field.code, emptySearchValue(field)]));

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SearchPanel
        conditions={conditions}
        values={draft}
        onValueChange={(code, next) => setDraft((current) => ({ ...current, [code]: next }))}
        onSearch={() => onChange(draft)}
        onReset={() => {
          const empty = cleared();
          setDraft(empty);
          onChange(empty);
        }}
        // Expanded layout is container-query responsive; every condition stays visible.
        expanded
        onExpandedChange={() => undefined}
        collapsedCount={conditions.length}
        compact={compact}
      />
      <ActiveConditionTags conditions={conditions} value={value} onChange={onChange} />
    </div>
  );
}
