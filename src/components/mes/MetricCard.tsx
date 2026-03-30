"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  invertTrend = false,
  icon: Icon,
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

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border border-[var(--border)] bg-white p-4 transition-shadow hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>

      {trend !== undefined && (
        <div className={cn("mt-2 flex items-center gap-1 text-xs", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span className="tabular-nums">{Math.abs(trend).toFixed(1)}%</span>
          <span className="text-muted-foreground">vs prev</span>
        </div>
      )}
    </div>
  );
}
