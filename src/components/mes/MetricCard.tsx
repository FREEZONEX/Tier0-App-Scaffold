"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * MetricCard — KPI card with large value, trend indicator, and optional sparkline area.
 *
 * Usage:
 *   <MetricCard label="Throughput" value="1,284" unit="pcs/hr" trend={3.2} />
 *   <MetricCard label="Downtime" value="12" unit="min" trend={-8.5} invertTrend />
 */

interface MetricCardProps {
  /** KPI label */
  label: string;
  /** Primary display value (pre-formatted string) */
  value: string;
  /** Unit suffix */
  unit?: string;
  /** Percentage change — positive = up, negative = down */
  trend?: number;
  /** When true, negative trend is "good" (green) and positive is "bad" (red). Useful for metrics like downtime, defects. */
  invertTrend?: boolean;
  /** Optional icon (Lucide component) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional footer slot — e.g. a MiniSparkline, ProgressRing, or any ReactNode */
  footer?: React.ReactNode;
  className?: string;
}

function parseNumeric(value: string): number | null {
  const cleaned = value.replace(/[,%]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  invertTrend = false,
  icon: Icon,
  footer,
  className,
}: MetricCardProps) {
  const trendColor = trend === undefined || trend === 0
    ? "text-muted-foreground"
    : (trend > 0) !== invertTrend
      ? "text-emerald-600"
      : "text-red-600";

  const TrendIcon = trend === undefined || trend === 0
    ? Minus
    : trend > 0
      ? TrendingUp
      : TrendingDown;

  const numericValue = parseNumeric(value);
  const hasDecimals = value.includes(".");
  const formatFn = hasDecimals
    ? (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : (n: number) => Math.round(n).toLocaleString();

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]",
        className
      )}
    >
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-[2px] bg-[var(--accent)]" />

      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        {numericValue !== null ? (
          <AnimatedNumber
            value={numericValue}
            format={formatFn}
            className="text-2xl font-semibold"
          />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        )}
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>

      {trend !== undefined && (
        <div className={cn("mt-2 flex items-center gap-1 text-xs transition-transform", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span className="tabular-nums">{Math.abs(trend).toFixed(1)}%</span>
          <span className="text-muted-foreground">vs prev</span>
        </div>
      )}

      {footer && (
        <div className="mt-3 -mx-4 -mb-4 border-t border-[var(--border)] px-4 py-2.5 bg-[var(--surface-inset)]">
          {footer}
        </div>
      )}
    </div>
  );
}
