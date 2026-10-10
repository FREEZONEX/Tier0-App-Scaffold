"use client";

/**
 * SearchPanel — 查询区 of generic lists and reference pickers.
 * Collapsed: the first 3 conditions in one row + 查询 / 重置 / 展开;
 * expanded: all conditions, 4 per row, with 查询 / 重置 / 收起 at the end of the last
 * row (灵动 101). 日期区间 takes two slots until the panel is wide enough to show
 * 「2026-06-17 → 2026-09-17」 in one. Controls follow the field type; Enter in a text box
 * runs the query, other edits wait for 查询. 查询 first commits a half-typed input
 * (e.g. a typed date); 重置 also clears whatever is still typed in the controls.
 */
import { ChevronsDown, ChevronsUp, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/kit/ui/date-picker";
import { IconButton } from "@/components/kit/ui/buttons";
import { Input } from "@/components/kit/ui/input";
import { NumberInput, NumberRangeInput } from "@/components/kit/ui/number-input";
import { Select } from "@/components/kit/ui/select";
import type { OptionItem } from "@/components/kit/ui/types";
import { isHiddenSearchCondition, isMultiValueCondition, searchControlKind, type SearchValues } from "@/lib/component-kit/query-model";
import type { FieldDef, RefValue } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { PersonInput, ReferenceInput } from "@/components/kit/meta/reference-input";

export interface SearchPanelProps {
  conditions: readonly FieldDef[];
  values: SearchValues;
  onValueChange: (code: string, value: unknown) => void;
  onSearch: () => void;
  onReset: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Conditions shown while collapsed (default 3). */
  collapsedCount?: number;
  /** Narrow containers (dialogs): 2 per row collapsed, 3 expanded. */
  compact?: boolean;
  loading?: boolean;
  className?: string;
}

type SelectValue = string | number;

function toOptions(field: FieldDef): OptionItem<SelectValue>[] {
  return (field.options ?? []).map((option) => ({ value: option.value, label: option.label, color: option.color ?? undefined }));
}

/** 灵动 writes「请输入XX」; dictionary placeholders that are just the field name get the prefix. */
function placeholderOf(field: FieldDef, verb: "输入" | "选择"): string {
  const own = field.widget?.placeholder?.trim();
  if (own && own.startsWith("请") && !/忽略将自动生成|不填则自动生成|自动带出/.test(own)) return own;
  return `请${verb}${field.name}`;
}

export interface SearchFieldControlProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onEnter?: () => void;
}

/** One search condition control, chosen by field type. */
export function SearchFieldControl({ field, value, onChange, onEnter }: SearchFieldControlProps) {
  const kind = searchControlKind(field);
  const label = field.name;
  switch (kind) {
    case "text":
      return (
        <Input
          aria-label={label}
          allowClear
          value={typeof value === "string" ? value : ""}
          placeholder={placeholderOf(field, "输入")}
          onChange={(next) => onChange(next)}
          onPressEnter={() => onEnter?.()}
        />
      );
    case "number":
      return (
        <NumberInput
          aria-label={label}
          value={typeof value === "number" ? value : null}
          precision={field.widget?.decimalPlaces}
          placeholder={placeholderOf(field, "输入")}
          onChange={(next) => onChange(next)}
          onPressEnter={() => onEnter?.()}
        />
      );
    case "number-range":
      return (
        <NumberRangeInput
          aria-label={label}
          value={Array.isArray(value) ? (value as [number | null, number | null]) : null}
          precision={field.widget?.decimalPlaces}
          onChange={(next) => onChange(next ?? [null, null])}
        />
      );
    case "date-range": {
      const range = Array.isArray(value) ? (value as [string | null, string | null]) : null;
      return (
        <DateRangePicker
          aria-label={label}
          precision="DATE"
          valueFormat="date"
          value={range && (range[0] || range[1]) ? range : null}
          placeholder={["开始日期", "结束日期"]}
          onChange={(next) => onChange(next ?? [null, null])}
        />
      );
    }
    case "select":
      return (
        <Select<SelectValue>
          aria-label={label}
          allowClear
          showSearch={(field.options?.length ?? 0) > 8}
          options={toOptions(field)}
          value={value === null || value === undefined || value === "" ? null : (value as SelectValue)}
          placeholder={`请选择${field.name}`}
          onChange={(next) => onChange(next)}
        />
      );
    case "multi-select":
      return (
        <Select<SelectValue>
          aria-label={label}
          multiple
          allowClear
          options={toOptions(field)}
          value={Array.isArray(value) ? (value as SelectValue[]) : []}
          placeholder={`请选择${field.name}`}
          onChange={(next) => onChange(next)}
        />
      );
    case "person":
      return (
        <PersonInput
          aria-label={label}
          multiple={isMultiValueCondition(field)}
          value={(value as RefValue | RefValue[] | null) ?? null}
          placeholder="请选择人员"
          onChange={(next) => onChange(next)}
        />
      );
    case "reference":
      return (
        <ReferenceInput
          aria-label={label}
          field={field}
          multiple={isMultiValueCondition(field)}
          value={(value as RefValue | RefValue[] | null) ?? null}
          placeholder={`请选择${field.name}`}
          onChange={(next) => onChange(next)}
        />
      );
    default:
      return null;
  }
}

export function SearchPanel({
  conditions,
  values,
  onValueChange,
  onSearch,
  onReset,
  expanded,
  onExpandedChange,
  collapsedCount = 3,
  compact = false,
  loading = false,
  className,
}: SearchPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onSearchRef = useRef(onSearch);
  useLayoutEffect(() => {
    onSearchRef.current = onSearch;
  });
  // Remounts the controls on 重置 so typed-but-uncommitted text (date inputs) goes away too.
  const [resetToken, setResetToken] = useState(0);

  const usable = conditions.filter((field) => !isHiddenSearchCondition(field) && searchControlKind(field) !== "none");
  if (usable.length === 0) return null;
  const canExpand = usable.length > collapsedCount;
  const shown = expanded ? usable : usable.slice(0, collapsedCount);

  const runSearch = () => {
    // Blur first: inputs commit on blur (a typed date range), then search with the fresh values.
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active)) active.blur();
    window.setTimeout(() => onSearchRef.current(), 0);
  };

  const actions = (
    <div className={cn("flex shrink-0 items-center justify-end gap-2", expanded && "ml-auto")}>
      <Button variant="primary" icon={<Search />} loading={loading} onClick={runSearch}>
        查询
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setResetToken((token) => token + 1);
          onReset();
        }}
      >
        重置
      </Button>
      {canExpand ? (
        <IconButton
          variant="outline"
          label={expanded ? "收起" : "展开"}
          icon={expanded ? <ChevronsUp /> : <ChevronsDown />}
          onClick={() => onExpandedChange(!expanded)}
        />
      ) : null}
    </div>
  );

  const item = (field: FieldDef, sizeClass?: string) => (
    <div key={`${field.code}:${resetToken}`} className={cn("flex min-w-0 items-center gap-2", sizeClass)}>
      <label
        className="w-[6.5rem] shrink-0 truncate text-right text-sm text-foreground"
        title={field.name}
        data-required-rendered="true"
      >
        {field.name}：
      </label>
      <div className="min-w-0 flex-1">
        <SearchFieldControl
          field={field}
          value={values[field.code]}
          onChange={(next) => onValueChange(field.code, next)}
          onEnter={runSearch}
        />
      </div>
    </div>
  );

  if (expanded) {
    return (
      <div ref={rootRef} role="search" className={cn("@container/search min-w-0", className)}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
          {shown.map((field) => {
            const wide = searchControlKind(field) === "date-range";
            const sizeClass = compact
              ? wide
                ? "w-full @min-[40rem]/search:w-[calc((100%_-_1.5rem)/2)] @min-[56rem]/search:w-[calc((100%_-_3rem)*2/3_+_1.5rem)] @min-[72rem]/search:w-[calc((100%_-_3rem)/3)]"
                : "w-full @min-[30rem]/search:w-[calc((100%_-_1.5rem)/2)] @min-[56rem]/search:w-[calc((100%_-_3rem)/3)]"
              : wide
                ? "w-full @min-[56rem]/search:w-[calc((100%_-_1.5rem)/2)] @min-[100rem]/search:w-[calc((100%_-_4.5rem)/4)]"
                : "w-full @min-[40rem]/search:w-[calc((100%_-_1.5rem)/2)] @min-[64rem]/search:w-[calc((100%_-_4.5rem)/4)]";
            return item(field, cn("shrink-0", sizeClass));
          })}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} role="search" className={cn("flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start", className)}>
      <div
        className={cn(
          "grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3",
          compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {shown.map((field) => item(field))}
      </div>
      {actions}
    </div>
  );
}
