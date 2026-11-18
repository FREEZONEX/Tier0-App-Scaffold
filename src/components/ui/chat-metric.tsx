import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export type ChatMetricTone = "default" | "warning" | "error";

export interface ChatMetricCardProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** Short qualifier under the number, e.g. "上限 42.0". */
  hint?: ReactNode;
  tone?: ChatMetricTone;
  className?: string;
}

const valueTone: Record<ChatMetricTone, string> = {
  default: "text-foreground",
  warning: "text-foreground",
  error: "text-destructive",
};

/**
 * ChatMetricCard — compact KPI inside a reply. Mapped from Arc metric-card
 * onto StatCard tokens, but sized for a transcript (not a dashboard tile).
 * The card stays white; tone colors the number, not the fill.
 */
export function ChatMetricCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
  className,
}: ChatMetricCardProps) {
  return (
    <article
      data-slot="chat-metric-card"
      data-tone={tone}
      className={cn("min-w-0 rounded-[4px] border border-border bg-card px-3 py-2.5", className)}
    >
      <p className="caption text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold leading-7 tracking-tight tabular-nums", valueTone[tone])}>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        {unit != null ? (
          <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {hint != null ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

export interface ChatMetricRowProps {
  children: ReactNode;
  className?: string;
}

/** Two-to-three compact metrics in a reply. */
export function ChatMetricRow({ children, className }: ChatMetricRowProps) {
  return (
    <div
      data-slot="chat-metric-row"
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}
    >
      {children}
    </div>
  );
}
