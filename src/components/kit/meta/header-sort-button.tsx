"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortSpec } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

/**
 * Quick sort beside a sortable column title: 未排序 → 升序 → 降序 → 未排序.
 * The only icon a list header carries by default; light gray until active.
 */
export function HeaderSortButton({
  name,
  direction,
  onChange,
}: {
  /** Column title, used in the accessible name. */
  name: string;
  direction: SortSpec["direction"] | null;
  onChange: (next: SortSpec["direction"] | null) => void;
}) {
  const next = direction === null ? "asc" : direction === "asc" ? "desc" : null;
  const label = `${name}：${direction === "asc" ? "升序" : direction === "desc" ? "降序" : "未排序"}，点击${next === "asc" ? "升序" : next === "desc" ? "降序" : "取消排序"}`;
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-[4px] outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&>svg]:size-3.5",
        direction ? "text-foreground" : "text-text-placeholder",
      )}
      onClick={() => onChange(next)}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
