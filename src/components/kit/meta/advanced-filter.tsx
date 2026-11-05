"use client";

/**
 * AdvancedFilter — 高级筛选（多条件组合筛选）. One control per field
 * (编码、名称、负责人、日期范围 …, by field type via SearchFieldControl). 查询 applies
 * the filled conditions together with AND; empty conditions do not take part.
 * Applied conditions show as tags under the panel: closing one removes only
 * that condition, 清空条件 removes all of them.
 *
 * Filter-bar layout: each label sits above its control, conditions wrap 1–4
 * per row by the container's width (container queries) with 查询 / 重置 after
 * the last one, so it fits a card, drawer or phone; show / hide the whole
 * panel from a host button (「高级筛选」). Controls come from
 * SearchFieldControl, so field types render as in SearchPanel.
 *
 * The component is controlled by the APPLIED values (`value` / `onChange`);
 * typing edits a draft until 查询. Filter rows with `filterListRows` from
 * `@/lib/component-kit/list-search`. For a single box matched against several
 * fields use KeywordSearch (关键词搜索); on one list the two combine with AND.
 */
import { Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextButton } from "@/components/kit/ui/buttons";
import { Tag } from "@/components/kit/ui/tag";
import { SearchFieldControl } from "@/components/kit/meta/search-panel";
import { describeCondition } from "@/lib/component-kit/list-search";
import { emptySearchValue, isHiddenSearchCondition, searchControlKind, type SearchValues } from "@/lib/component-kit/query-model";
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
  /** Narrow containers (drawers, dialogs): at most 2 conditions per row. */
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
  // Remounts the controls on 重置 so half-typed input (e.g. a typed date) goes away too.
  const [resetToken, setResetToken] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Applied values changed outside (a tag closed, 清除筛选): mirror them into the draft.
  if (applied !== value) {
    setApplied(value);
    setDraft(value);
  }

  const usable = conditions.filter((field) => !isHiddenSearchCondition(field) && searchControlKind(field) !== "none");
  const cleared = () => Object.fromEntries(conditions.map((field) => [field.code, emptySearchValue(field)]));
  const draftRef = useRef(draft);
  useLayoutEffect(() => {
    draftRef.current = draft;
  });
  const runSearch = () => {
    // Blur first: inputs commit on blur (a typed date range), then apply the fresh draft.
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active)) active.blur();
    window.setTimeout(() => onChange(draftRef.current), 0);
  };

  return (
    <div ref={rootRef} className={cn("@container/filter flex min-w-0 flex-col gap-3", className)}>
      <div
        role="search"
        aria-label="高级筛选"
        className={cn(
          "grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 @min-[34rem]/filter:grid-cols-2",
          !compact && "@min-[54rem]/filter:grid-cols-3 @min-[72rem]/filter:grid-cols-4",
        )}
      >
        {usable.map((field) => (
          <div key={`${field.code}:${resetToken}`} className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-xs text-muted-foreground" title={field.name}>
              {field.name}
            </span>
            <SearchFieldControl
              field={field}
              value={draft[field.code]}
              onChange={(next) => setDraft((current) => ({ ...current, [field.code]: next }))}
              onEnter={runSearch}
            />
          </div>
        ))}
        <div className="flex min-w-0 items-end justify-end gap-2 @min-[34rem]/filter:justify-start">
          <Button variant="primary" icon={<Search />} onClick={runSearch}>
            查询
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const empty = cleared();
              setResetToken((token) => token + 1);
              setDraft(empty);
              onChange(empty);
            }}
          >
            重置
          </Button>
        </div>
      </div>
      <ActiveConditionTags conditions={conditions} value={value} onChange={onChange} />
    </div>
  );
}
