"use client";

/**
 * KeywordSearch — 关键词搜索（多字段模糊搜索）. One search box; the same
 * keyword is matched, case-insensitively and as a substring, against several
 * fields the business configures (编号 / 名称 / 规格 …). A record is returned
 * when ANY configured field contains the keyword. It is scoped to the current
 * list's fields — not a cross-app or platform-wide search.
 *
 * Filtering itself is `matchesKeyword` / `filterListRows` from
 * `@/lib/component-kit/list-search`, so the box and the rule stay in sync.
 * For per-field conditions combined with AND, use AdvancedFilter
 * (高级筛选); on the same list the two combine with AND.
 */
import { Search } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/kit/ui/input";
import type { KeywordField } from "@/lib/component-kit/list-search";
import { cn } from "@/lib/utils";

export interface KeywordSearchProps<Row = unknown> {
  value: string;
  onChange: (value: string) => void;
  /** Fields the keyword is matched against; labels build the placeholder and hint. */
  fields: readonly Pick<KeywordField<Row>, "label">[];
  /** Accessible name (default 「关键词搜索」). */
  label?: string;
  /** Default 「搜索编号、名称、规格」 from `fields`. */
  placeholder?: string;
  className?: string;
}

export function KeywordSearch<Row = unknown>({
  value,
  onChange,
  fields,
  label = "关键词搜索",
  placeholder,
  className,
}: KeywordSearchProps<Row>) {
  const hintId = useId();
  const scope = fields.map((field) => field.label).join("、");
  return (
    <div role="search" className={cn("min-w-0", className)}>
      <Input
        aria-label={label}
        aria-describedby={hintId}
        value={value}
        onChange={(next) => onChange(next)}
        prefix={<Search size={14} aria-hidden="true" />}
        placeholder={placeholder ?? `搜索${scope}`}
        allowClear
        wrapperClassName="w-full"
      />
      <span id={hintId} className="sr-only">
        同时模糊匹配：{scope}，任一字段包含关键词即返回
      </span>
    </div>
  );
}
