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
      role="tablist"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm leading-none transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "border-highlight-bg-primary bg-highlight-bg-accent font-medium text-foreground"
                : "border-border bg-card text-secondary-foreground hover:bg-surface-inset",
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
