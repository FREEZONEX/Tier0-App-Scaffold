import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatCard — dashboard summary tile. Value comes from real (seeded or live)
 * data, never an invented number. A stat is a summary, not an entry point:
 * pair it with a link/queue (`footer` or wrap in <Link>) so users can act.
 */
export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Unit or short qualifier rendered after the value (e.g. "kg", "项"). */
  unit?: ReactNode;
  icon?: ReactNode;
  /** Small line under the value: trend, scope, or a link to the module. */
  footer?: ReactNode;
  tone?: "default" | "running" | "paused" | "error";
  className?: string;
}

const toneValueClass = {
  default: "text-foreground",
  running: "text-[color:var(--state-running-fg)]",
  paused: "text-[color:var(--state-paused-fg)]",
  error: "text-[color:var(--state-error-fg)]",
} as const;

export function StatCard({
  label,
  value,
  unit,
  icon,
  footer,
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
          <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
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
      {footer && <div className="caption mt-1.5">{footer}</div>}
    </div>
  );
}
