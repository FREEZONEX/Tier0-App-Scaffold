"use client";

import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * TargetBar — compact horizontal bar showing actual vs target.
 * Stack multiple TargetBars vertically for a comparison dashboard strip.
 *
 * Usage:
 *   <TargetBar label="Throughput" actual={1284} target={1500} unit="pcs/hr" />
 *   <TargetBar label="Defect Rate" actual={2.1} target={1.5} unit="%" invertColor />
 */

interface TargetBarProps {
  /** Metric label */
  label: string;
  /** Actual measured value */
  actual: number;
  /** Target/goal value */
  target: number;
  /** Unit suffix */
  unit?: string;
  /** Format function for numbers */
  format?: (n: number) => string;
  /** When true, exceeding target is bad (red). Used for defects, downtime, etc. */
  invertColor?: boolean;
  className?: string;
}

const defaultFormat = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);

export function TargetBar({
  label,
  actual,
  target,
  unit,
  format = defaultFormat,
  invertColor = false,
  className,
}: TargetBarProps) {
  const ratio = target > 0 ? Math.min(actual / target, 1.5) : 0;
  const percent = Math.min(ratio * 100, 100);
  const isOnTarget = invertColor ? actual <= target : actual >= target;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Header row */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium">{label}</span>
        <div className="flex items-baseline gap-1 text-xs tabular-nums">
          <AnimatedNumber value={actual} format={format} className="font-semibold" />
          <span className="text-muted-foreground">/ {format(target)}</span>
          {unit && <span className="text-muted-foreground">{unit}</span>}
        </div>
      </div>

      {/* Bar */}
      <div className="flex items-center gap-2">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              isOnTarget ? "bg-[var(--accent)]" : "bg-red-400"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
          />
        </div>
        <span className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          isOnTarget ? "bg-[var(--accent)]/15 text-[var(--accent-strong)]" : "bg-red-50 text-red-600"
        )}>
          {Math.round(ratio * 100)}%
        </span>
      </div>
    </div>
  );
}
