import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatCard — dashboard summary tile. Value comes from real (seeded or live)
 * data, never an invented number.
 *
 * `tone` drives both the value color and the icon chip (`default` = neutral
 * grey; running/paused/error/info tint it). `trend` renders a semantic arrow +
 * delta. `footer` is free for a link or scope line. Use what the metric needs.
 */
export type StatTone = "default" | "running" | "paused" | "error" | "info";

export interface StatTrend {
  /** Arrow shown before the label. Direction is the movement, not the mood. */
  direction: "up" | "down" | "flat";
  /** Short delta text, e.g. "+6" or "8%". */
  label: ReactNode;
  /**
   * Whether this movement reads as good/bad in this metric's context — a
   * rising defect count is negative, a rising throughput is positive. Colors
   * the trend; defaults to neutral so an unspecified trend never miscolors.
   */
  intent?: "positive" | "negative" | "neutral";
}

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Unit or short qualifier rendered after the value (e.g. "kg", "项"). */
  unit?: ReactNode;
  icon?: ReactNode;
  /** Small line under the value: trend, scope, or a link to the module. */
  footer?: ReactNode;
  /** Movement vs a prior period, rendered as a semantic arrow + delta. */
  trend?: StatTrend;
  tone?: StatTone;
  className?: string;
}

const toneValueClass: Record<StatTone, string> = {
  default: "text-foreground",
  running: "text-[color:var(--state-running-fg)]",
  paused: "text-[color:var(--state-paused-fg)]",
  error: "text-[color:var(--state-error-fg)]",
  info: "text-[color:var(--state-info-fg)]",
};

const toneChipClass: Record<StatTone, string> = {
  default: "bg-surface-inset text-muted-foreground",
  running: "bg-[color:var(--state-running-bg)] text-[color:var(--state-running-fg)]",
  paused: "bg-[color:var(--state-paused-bg)] text-[color:var(--state-paused-fg)]",
  error: "bg-[color:var(--state-error-bg)] text-[color:var(--state-error-fg)]",
  info: "bg-[color:var(--state-info-bg)] text-[color:var(--state-info-fg)]",
};

const trendIntentClass = {
  positive: "text-[color:var(--tier0-success-color)]",
  negative: "text-[color:var(--state-error-fg)]",
  neutral: "text-muted-foreground",
} as const;

function TrendArrow({ direction }: { direction: StatTrend["direction"] }) {
  const d =
    direction === "up"
      ? "m5 15 7-7 7 7"
      : direction === "down"
        ? "m5 9 7 7 7-7"
        : "M5 12h14";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  footer,
  trend,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="caption">{label}</p>
        {icon && (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-md [&>svg]:size-4",
              toneChipClass[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold leading-8 tabular-nums",
          toneValueClass[tone],
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {(trend || footer) && (
        <div className="mt-1.5 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                trendIntentClass[trend.intent ?? "neutral"],
              )}
            >
              <TrendArrow direction={trend.direction} />
              {trend.label}
            </span>
          )}
          {footer && <div className="caption">{footer}</div>}
        </div>
      )}
    </div>
  );
}
