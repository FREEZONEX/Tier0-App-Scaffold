import { cn } from "@/lib/utils";

/**
 * StatusFilterChips — the professional list-page filter row: one chip per
 * status with a live count, single-select. Feed counts from the loaded
 * dataset (or a server aggregate); never invent numbers.
 *
 * Example:
 *   <StatusFilterChips
 *     items={[
 *       { key: "all", label: "全部", count: 6 },
 *       { key: "normal", label: "正常", count: 3 },
 *       { key: "expired", label: "过期", count: 1 },
 *     ]}
 *     value={filter}
 *     onChange={setFilter}
 *   />
 */
export interface FilterChipItem {
  key: string;
  label: string;
  count?: number;
}

export interface StatusFilterChipsProps {
  items: FilterChipItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function StatusFilterChips({
  items,
  value,
  onChange,
  className,
}: StatusFilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="状态筛选"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-8 pointer-coarse:h-11 items-center gap-1.5 rounded-[4px] border px-3 text-sm leading-none outline-none",
              "transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              "focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transition-none",
              active
                // Selection is neutral: a tinted fill and heavier text, no outline darker than the label. Lime is for the key CTA only.
                ? "border-transparent bg-foreground/[0.08] font-semibold text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "font-mono text-xs leading-none",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
