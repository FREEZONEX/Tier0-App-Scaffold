"use client";

import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * SummaryStrip — horizontal compact KPI summary bar.
 * More space-efficient than a grid of MetricCards. Ideal for page tops.
 *
 * Usage:
 *   <SummaryStrip
 *     items={[
 *       { label: "Total Orders", value: 142 },
 *       { label: "In Progress", value: 38, color: "var(--accent)" },
 *       { label: "Completed", value: 96, color: "#10b981" },
 *       { label: "Overdue", value: 8, color: "#ef4444" },
 *     ]}
 *   />
 */

interface SummaryItem {
  label: string;
  value: number;
  /** Optional color accent for the value. */
  color?: string;
  /** Unit suffix */
  unit?: string;
  /** Number format function */
  format?: (n: number) => string;
}

interface SummaryStripProps {
  items: SummaryItem[];
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString();

export function SummaryStrip({ items, className }: SummaryStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center divide-x divide-[var(--border)] rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-0.5 px-4 py-3 min-w-[100px]">
          <AnimatedNumber
            value={item.value}
            format={item.format ?? defaultFormat}
            className="text-lg font-bold tabular-nums"
          />
          {item.unit && (
            <span className="text-[10px] text-muted-foreground">{item.unit}</span>
          )}
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {item.label}
          </span>
          {item.color && (
            <span className="mt-0.5 h-[2px] w-6 rounded-full" style={{ backgroundColor: item.color }} />
          )}
        </div>
      ))}
    </div>
  );
}
