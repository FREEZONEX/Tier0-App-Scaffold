import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ResponsivePage } from "@/components/ui/responsive-page";

/**
 * WorkbenchLayout — the safe page-root composition for management workspaces.
 * It keeps KPIs as a compact summary and gives the real work most of the page:
 * a primary queue/table plus an optional secondary risk or decision surface.
 *
 * Put PageHeader in `header`, StatCards in `metrics`, and the primary work
 * surface in `children`. At wide breakpoints the optional `aside` becomes a
 * restrained 2:1 column that stays in view while the main queue scrolls; on
 * smaller screens every region stacks naturally.
 *
 * `metricsVariant="strip"` renders KPIs as one divided band (dense consoles);
 * the default "cards" keeps separate StatCards. Metrics rise in sequence.
 */
export interface WorkbenchLayoutProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  header: ReactNode;
  metrics?: ReactNode;
  aside?: ReactNode;
  below?: ReactNode;
  /** "cards" (default): separate StatCards. "strip": one divided KPI band. */
  metricsVariant?: "cards" | "strip";
  children: ReactNode;
}

/** Sequenced entry for direct metric children (first eight). */
const METRIC_STAGGER = [
  "[&>*]:animate-[tier0-rise_260ms_var(--motion-spring)_both]",
  "[&>*:nth-child(2)]:[animation-delay:40ms] [&>*:nth-child(3)]:[animation-delay:80ms]",
  "[&>*:nth-child(4)]:[animation-delay:120ms] [&>*:nth-child(5)]:[animation-delay:160ms]",
  "[&>*:nth-child(6)]:[animation-delay:200ms] [&>*:nth-child(n+7)]:[animation-delay:240ms]",
].join(" ");

/** Strip variant: children lose their own card chrome and share dividers.
 * KPI cells are not clickable — only a faint fill on hover, no stroke. */
const METRIC_STRIP = [
  "overflow-hidden rounded-[4px] border border-border bg-card shadow-xs",
  "grid grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none",
  "[&>*]:relative [&>*]:!rounded-none [&>*]:border-0 [&>*]:shadow-none [&>*]:hover:shadow-none",
  "[&>*]:border-border [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0",
  "[&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0",
  "[&>*:hover]:bg-[color:var(--tier0-fill-hover)]",
].join(" ");

export function WorkbenchLayout({
  header,
  metrics,
  aside,
  below,
  metricsVariant = "cards",
  className,
  children,
  ...props
}: WorkbenchLayoutProps) {
  return (
    <ResponsivePage
      className={cn(className)}
      {...props}
    >
      {header}

      {metrics && (
        <section
          className={cn(
            metricsVariant === "strip"
              ? METRIC_STRIP
              : "grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4",
            METRIC_STAGGER,
          )}
        >
          {metrics}
        </section>
      )}

      <div
        className={cn(
          "grid min-w-0 items-start gap-4",
          aside &&
            "lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]",
        )}
      >
        <section className="min-w-0">{children}</section>
        {aside && (
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">{aside}</aside>
        )}
      </div>

      {below}
    </ResponsivePage>
  );
}
