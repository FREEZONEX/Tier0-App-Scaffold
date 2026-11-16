import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_FILL } from "@/lib/interaction";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Tag } from "@/components/kit/ui/tag";
import type { TagTone } from "@/components/kit/ui/types";

/**
 * StatCard — dashboard summary tile. Value comes from real (seeded or live)
 * data, never an invented number.
 *
 * Layout: muted label, a large tabular number, an optional trend Tag
 * beside the number, and a 36px gray icon tile at the top-right. The card
 * itself stays white. The trend Tag carries the semantic color (green /
 * red / blue), with no stroke.
 *
 * `trend` is a Tag (arrow + delta), colored by intent. Numeric `value`s
 * roll on live refresh. `footer` holds a progress bar or scope line.
 * Filters and actions belong in the toolbar.
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
  /**
   * Explicit display rule for a numeric `value` (currency, percent, fixed
   * decimals). Omit it to show the value at its own precision — `0.04` stays
   * `0.04`; the live-update roll never rounds the business number.
   */
  format?: Intl.NumberFormatOptions;
  icon?: ReactNode;
  /** Small line under the value: trend, scope, or a link to the module. */
  footer?: ReactNode;
  /** Movement vs a prior period, rendered as a semantic arrow + delta. */
  trend?: StatTrend;
  tone?: StatTone;
  /**
   * Optional. Prefer keeping StatCards read-only (KPI glance only) and put
   * filters/actions in the toolbar below. When set, the card becomes a button.
   */
  onClick?: () => void;
  /** Selected look when `onClick` is used. */
  active?: boolean;
  className?: string;
}

const trendTagTone: Record<NonNullable<StatTrend["intent"]>, TagTone> = {
  positive: "success",
  negative: "error",
  neutral: "processing",
};

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
      className="size-3.5"
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
  format,
  icon,
  footer,
  trend,
  tone = "default",
  onClick,
  active = false,
  className,
}: StatCardProps) {
  const interactive = typeof onClick === "function";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="caption pt-0.5 text-muted-foreground">{label}</p>
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[4px] bg-muted text-foreground [&>svg]:size-5 [&>svg]:stroke-[1.75]"
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2.5">
        <p className="text-[2rem] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-4xl sm:leading-none">
          {typeof value === "number" ? (
            <AnimatedNumber value={value} format={format} />
          ) : (
            value
          )}
          {unit && (
            <span className="ml-1.5 text-lg font-normal tracking-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </p>
        {trend && (
          <Tag
            bordered={false}
            tone={trendTagTone[trend.intent ?? "neutral"]}
            icon={<TrendArrow direction={trend.direction} />}
            className="mb-0.5 h-6 !border-transparent px-2 text-sm leading-none tabular-nums [&_svg]:size-3.5"
          >
            {trend.label}
          </Tag>
        )}
      </div>
      {footer && <div className="mt-3 min-w-0">{footer}</div>}
    </>
  );

  const surface = cn(
    "group relative flex h-full min-h-[7.25rem] min-w-0 flex-col rounded-[4px] border border-border bg-card p-4 text-left shadow-sm",
    "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none",
    "animate-[tier0-rise_260ms_var(--motion-spring)_both]",
    interactive
      ? cn(
          "cursor-pointer",
          FOCUS_FILL,
          "hover:-translate-y-px hover:shadow-card hover:bg-[color:var(--tier0-fill-hover)]",
          "active:translate-y-0 active:scale-[0.99]",
          active && "bg-muted",
        )
      : null,
    className,
  );

  if (interactive) {
    return (
      <button
        type="button"
        data-tone={tone}
        aria-pressed={active}
        className={surface}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <div data-tone={tone} className={surface}>
      {body}
    </div>
  );
}
