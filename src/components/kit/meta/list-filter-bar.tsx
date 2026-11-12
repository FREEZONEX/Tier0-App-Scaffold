"use client";

/**
 * List query controls of MetaListPage, laid out by the list action rules
 * (docs/component-kit.md →「列表页操作区规范」):
 *
 * - `ListSearchBox` — the first text condition as one search box in the
 *   toolbar (magnifier, no outside label, bounded width). Enter or clearing
 *   runs the query.
 * - `ListFilterButton` —「筛选」toggle for every other condition, with the
 *   number of applied conditions.
 * - `ListFilterPanel` — the other conditions under the toolbar: label above
 *   control, 2–4 per row, 重置 / 查询 at the end.
 */
import { ListFilter, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/kit/ui/input";
import { isHiddenSearchCondition, searchControlKind, type SearchValues } from "@/lib/component-kit/query-model";
import type { FieldDef } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { SearchFieldControl } from "@/components/kit/meta/search-panel";

/** Splits search conditions into the toolbar keyword box and the 筛选 panel. */
export function splitSearchConditions(conditions: readonly FieldDef[]) {
  const usable = conditions.filter((field) => !isHiddenSearchCondition(field) && searchControlKind(field) !== "none");
  const keyword = usable.find((field) => searchControlKind(field) === "text") ?? null;
  return { keyword, panel: usable.filter((field) => field !== keyword) };
}

/** Runs `onSearch` after the current state update and input blur have landed. */
function useDeferredSearch(onSearch: () => void) {
  const ref = useRef(onSearch);
  useLayoutEffect(() => {
    ref.current = onSearch;
  });
  return () => window.setTimeout(() => ref.current(), 0);
}

export function ListSearchBox({
  field,
  value,
  onChange,
  onSearch,
  className,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: string) => void;
  onSearch: () => void;
  className?: string;
}) {
  const runSearch = useDeferredSearch(onSearch);
  return (
    <div role="search" className={cn("min-w-0", className)}>
      <Input
        aria-label={`搜索${field.name}`}
        value={typeof value === "string" ? value : ""}
        prefix={<Search size={14} aria-hidden="true" />}
        placeholder={`搜索${field.name}`}
        allowClear
        wrapperClassName="w-full"
        onChange={(next) => {
          onChange(next);
          if (next === "") runSearch();
        }}
        onPressEnter={runSearch}
      />
    </div>
  );
}

export function ListFilterButton({
  open,
  activeCount,
  onToggle,
  controls,
}: {
  open: boolean;
  activeCount: number;
  onToggle: () => void;
  /** id of the panel this button opens. */
  controls: string;
}) {
  return (
    <Button
      variant="outline"
      icon={<ListFilter />}
      aria-expanded={open}
      aria-controls={controls}
      className={cn(open && "bg-muted")}
      onClick={onToggle}
    >
      筛选
      {activeCount > 0 ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-4 text-primary-foreground tabular-nums">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );
}

export function ListFilterPanel({
  id,
  fields,
  values,
  onValueChange,
  onSearch,
  onReset,
  loading = false,
}: {
  id: string;
  fields: readonly FieldDef[];
  values: SearchValues;
  onValueChange: (code: string, value: unknown) => void;
  onSearch: () => void;
  onReset: () => void;
  loading?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredSearch(onSearch);
  // Remounts the controls on 重置 so typed-but-uncommitted text (date inputs) goes away too.
  const [resetToken, setResetToken] = useState(0);

  const runSearch = () => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active)) active.blur();
    deferredSearch();
  };

  return (
    <div
      id={id}
      ref={rootRef}
      role="search"
      aria-label="筛选条件"
      className="@container/filters min-w-0 rounded-[4px] border border-border bg-card p-3"
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 @min-[34rem]/filters:grid-cols-2 @min-[56rem]/filters:grid-cols-3 @min-[76rem]/filters:grid-cols-4">
        {fields.map((field) => (
          <div key={`${field.code}:${resetToken}`} className="flex min-w-0 flex-col gap-1.5">
            <span aria-hidden="true" className="truncate text-xs font-medium text-muted-foreground" title={field.name}>
              {field.name}
            </span>
            <SearchFieldControl
              field={field}
              value={values[field.code]}
              onChange={(next) => onValueChange(field.code, next)}
              onEnter={runSearch}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setResetToken((token) => token + 1);
            onReset();
          }}
        >
          重置
        </Button>
        <Button variant="primary" icon={<Search />} loading={loading} onClick={runSearch}>
          查询
        </Button>
      </div>
    </div>
  );
}
