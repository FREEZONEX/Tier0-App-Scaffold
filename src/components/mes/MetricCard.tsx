"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * MetricCard — KPI card with large value, trend indicator, and optional footer slot.
 *
 * Typography: label in sans (UI chrome), numeric value in mono (alignment +
 * tabular nums). Border-driven separation, no accent decoration — the value
 * itself is the point.
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
  /** When true, negative trend is "good" (green) and positive is "bad" (red).
   * Useful for metrics where lower is better — downtime, defects, scrap. */
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
  const trendColor =
    trend === undefined || trend === 0
      ? "text-muted-foreground"
      : (trend > 0) !== invertTrend
        ? "text-[var(--state-running-fg)]"
        : "text-[var(--state-error-fg)]";

  const TrendIcon =
    trend === undefined || trend === 0
      ? Minus
      : trend > 0
        ? TrendingUp
        : TrendingDown;

  const numericValue = parseNumeric(value);
  const hasDecimals = value.includes(".");
  const formatFn = hasDecimals
    ? (n: number) =>
        n.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
    : (n: number) => Math.round(n).toLocaleString();

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-md border border-border bg-card p-3",
        "transition-colors hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5 font-mono">
        {numericValue !== null ? (
          <AnimatedNumber
            value={numericValue}
            format={formatFn}
            className="text-2xl font-semibold tabular-nums tracking-tight"
          />
        ) : (
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </span>
        )}
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>

      {trend !== undefined && (
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px] font-medium",
            trendColor,
          )}
        >
          <TrendIcon className="size-3" />
          <span className="tabular-nums font-mono">
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-muted-foreground font-sans">vs prev</span>
        </div>
      )}

      {footer && (
        <div className="mt-3 -mx-3 -mb-3 border-t border-border bg-[var(--surface-inset)] px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  );
}
