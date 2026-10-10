"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/kit/ui/select";

export interface PaginationProps {
  total: number;
  /** 1-based page number. */
  current: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  /** Default [10, 20, 50, 100]. */
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  /** 「跳至 [ ] 页」. */
  showQuickJumper?: boolean;
  /** true → 「共 N 条」; a function renders custom text. */
  showTotal?: boolean | ((total: number, range: [number, number]) => ReactNode);
  size?: "sm" | "md";
  disabled?: boolean;
  hideOnSinglePage?: boolean;
  className?: string;
}

type PageToken = number | "prev-more" | "next-more";

function pageTokens(current: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "next-more", totalPages];
  if (current >= totalPages - 3) {
    return [1, "prev-more", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "prev-more", current - 2, current - 1, current, current + 1, current + 2, "next-more", totalPages];
}

export function Pagination({
  total,
  current,
  pageSize,
  onChange,
  pageSizeOptions = [10, 20, 50, 100],
  showSizeChanger = true,
  showQuickJumper = true,
  showTotal = true,
  size = "md",
  disabled = false,
  hideOnSinglePage = false,
  className,
}: PaginationProps) {
  const [jumpText, setJumpText] = useState("");
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  const page = Math.min(Math.max(1, current), totalPages);
  const small = size === "sm";

  if (hideOnSinglePage && totalPages <= 1) return null;

  function go(next: number) {
    const target = Math.min(Math.max(1, next), totalPages);
    if (disabled || target === page) return;
    onChange(target, pageSize);
  }

  function jump() {
    const target = Number.parseInt(jumpText, 10);
    setJumpText("");
    if (Number.isFinite(target)) go(target);
  }

  const itemClass = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center justify-center rounded-md tabular-nums transition-colors duration-150",
      small ? "h-6 min-w-6 px-1 text-sm" : "h-8 min-w-8 px-1.5 text-sm",
      active ? "bg-brand-soft font-medium text-brand" : "text-foreground hover:bg-fill-hover",
      disabled && "cursor-not-allowed text-text-placeholder hover:bg-transparent",
    );

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="分页"
      className={cn("flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-2 text-sm", className)}
    >
      {showTotal ? (
        <span className="mr-2 whitespace-nowrap text-text-secondary">
          {typeof showTotal === "function" ? showTotal(total, [rangeStart, rangeEnd]) : `共 ${total} 条`}
        </span>
      ) : null}

      <button
        type="button"
        aria-label="上一页"
        title="上一页"
        disabled={disabled || page <= 1}
        className={cn(itemClass(false), "disabled:cursor-not-allowed disabled:text-text-placeholder disabled:hover:bg-transparent")}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>

      <span className="hidden items-center gap-1 sm:inline-flex">
        {pageTokens(page, totalPages).map((token) =>
          typeof token === "number" ? (
            <button
              type="button"
              key={token}
              aria-label={`第 ${token} 页`}
              aria-current={token === page ? "page" : undefined}
              disabled={disabled}
              className={itemClass(token === page)}
              onClick={() => go(token)}
            >
              {token}
            </button>
          ) : (
            <button
              type="button"
              key={token}
              aria-label={token === "prev-more" ? "向前 5 页" : "向后 5 页"}
              title={token === "prev-more" ? "向前 5 页" : "向后 5 页"}
              disabled={disabled}
              className={cn(itemClass(false), "group text-text-placeholder")}
              onClick={() => go(token === "prev-more" ? page - 5 : page + 5)}
            >
              <span className="tracking-[2px] group-hover:hidden">•••</span>
              {token === "prev-more" ? (
                <ChevronsLeft className="hidden size-4 text-brand group-hover:block" />
              ) : (
                <ChevronsRight className="hidden size-4 text-brand group-hover:block" />
              )}
            </button>
          ),
        )}
      </span>
      <span className="whitespace-nowrap px-1 tabular-nums text-text-secondary sm:hidden">
        {page} / {totalPages}
      </span>

      <button
        type="button"
        aria-label="下一页"
        title="下一页"
        disabled={disabled || page >= totalPages}
        className={cn(itemClass(false), "disabled:cursor-not-allowed disabled:text-text-placeholder disabled:hover:bg-transparent")}
        onClick={() => go(page + 1)}
      >
        <ChevronRight className="size-4" />
      </button>

      {showSizeChanger ? (
        <Select<number>
          aria-label="每页条数"
          size={small ? "sm" : "md"}
          disabled={disabled}
          className={cn("ml-2 hidden sm:flex", small ? "w-[92px]" : "w-[104px]")}
          value={pageSize}
          options={pageSizeOptions.map((option) => ({ value: option, label: `${option} 条/页` }))}
          placement="top-start"
          onChange={(next) => {
            if (next !== null && next !== pageSize) onChange(1, next);
          }}
        />
      ) : null}

      {showQuickJumper && totalPages > 1 ? (
        <span className="ml-2 hidden items-center gap-2 whitespace-nowrap text-text-secondary sm:inline-flex">
          跳至
          <input
            aria-label="跳转页码"
            inputMode="numeric"
            data-bare-control=""
            disabled={disabled}
            value={jumpText}
            className={cn(
              "rounded-md border border-border-strong bg-card text-center tabular-nums text-foreground outline-none transition-[border-color,box-shadow] hover:border-brand-hover focus:border-brand focus:shadow-[0_0_0_2px_rgb(115_178_0/0.15)]",
              small ? "h-6 w-11 text-sm" : "h-8 w-12 text-sm",
            )}
            onChange={(event) => setJumpText(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") jump();
            }}
            onBlur={jump}
          />
          页
        </span>
      ) : null}
    </nav>
  );
}
