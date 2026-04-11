"use client";

import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * Leaderboard — ranked list with visual bars showing relative magnitude.
 * Completely different visual pattern from DataTable.
 *
 * Usage:
 *   <Leaderboard
 *     title="Top Machines"
 *     items={[
 *       { label: "CNC-01", value: 1842, meta: "98.2% OEE" },
 *       { label: "CNC-03", value: 1650, meta: "94.1% OEE" },
 *       { label: "CNC-02", value: 1203, meta: "87.5% OEE" },
 *     ]}
 *     unit="pcs"
 *   />
 */

interface LeaderboardItem {
  label: string;
  value: number;
  meta?: string;
}

interface LeaderboardProps {
  items: LeaderboardItem[];
  /** Optional card title */
  title?: string;
  /** Unit suffix */
  unit?: string;
  /** Max items to display. Default 10. */
  maxItems?: number;
  /** Number format function */
  format?: (n: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString();

const rankColors = [
  "bg-[var(--accent)]",
  "bg-gray-500",
  "bg-gray-400",
];

export function Leaderboard({
  items,
  title,
  unit,
  maxItems = 10,
  format = defaultFormat,
  className,
}: LeaderboardProps) {
  const sorted = [...items]
    .sort((a, b) => b.value - a.value)
    .slice(0, maxItems);

  const maxValue = sorted[0]?.value ?? 1;

  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]", className)}>
      {title && (
        <div className="border-b border-[var(--border)] px-4 py-2.5">
          <span className="text-xs font-semibold">{title}</span>
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {sorted.map((item, i) => {
          const barPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const barColor = rankColors[i] ?? "bg-gray-300";

          return (
            <motion.div
              key={item.label}
              className="flex items-center gap-3 px-4 py-2.5"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              {/* Rank */}
              <span className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold",
                i < 3 ? "bg-foreground text-background" : "bg-gray-100 text-muted-foreground"
              )}>
                {i + 1}
              </span>

              {/* Label + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{item.label}</span>
                  <div className="flex shrink-0 items-baseline gap-1">
                    <AnimatedNumber value={item.value} format={format} className="text-xs font-semibold" />
                    {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
                  </div>
                </div>

                {/* Bar */}
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    className={cn("h-full rounded-full", barColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${barPercent}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 20, delay: i * 0.03 }}
                  />
                </div>

                {item.meta && (
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{item.meta}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">No data</div>
      )}
    </div>
  );
}
