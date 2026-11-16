import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card — Tier0 panel: white surface, compact header over one hairline,
 * roomy body. Keeps the scaffold Card API (title / actions / footer / accent /
 * flush). Put a lucide icon before the title text; it renders muted.
 *
 * Variants: "panel" (default — white header flush into white body),
 * "frame" (muted shell + inset panel for a toolbar-heavy work surface),
 * "plain" (single box for nested/small cards sitting in a gray well).
 *
 * Headers stay compact (min-h-10, extra top padding), unfilled, and without a hairline —
 * depth comes from the workspace canvas (`--workspace`, sidebar gray
 * mixed 60% with white). Do not add extra header fills on nested/plain cards.
 * Problem KPIs use a light wash. Exception rows use a semantic left bar
 * (not a gray ring, and not an accent on the outer Card). Routine cards stay white.
 */
export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  accent?: "running" | "paused" | "error" | "info";
  /** Remove default body padding (e.g. to place a table flush). */
  flush?: boolean;
  variant?: "panel" | "frame" | "plain";
}

const accentClass: Record<NonNullable<CardProps["accent"]>, string> = {
  running: "border-l-[3px] border-l-[color:var(--state-running-fg)]",
  paused: "border-l-[3px] border-l-[color:var(--state-paused-fg)]",
  error: "border-l-[3px] border-l-[color:var(--state-error-fg)]",
  info: "border-l-[3px] border-l-[color:var(--state-info-fg)]",
};

/**
 * Nested exception rows: semantic left bar + soft fill, no extra ring.
 * error = severe (red), paused = mid (amber), info = low (blue).
 * Put these inside a plain Card — do not also accent the outer shell.
 */
export const exceptionItemClass = {
  error:
    "rounded-[4px] border-l-[3px] border-l-[color:var(--state-error-fg)] bg-state-error-wash p-3",
  paused:
    "rounded-[4px] border-l-[3px] border-l-[color:var(--state-paused-fg)] bg-state-paused-wash p-3",
  info:
    "rounded-[4px] border-l-[3px] border-l-[color:var(--state-info-fg)] bg-state-info-wash p-3",
} as const;

export function Card({
  title,
  actions,
  footer,
  accent,
  flush = false,
  variant = "panel",
  className,
  children,
  ...props
}: CardProps) {
  const framed = variant === "frame";
  const panel = variant === "panel";
  const hasHeader = Boolean(title || actions);

  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "group/card flex min-w-0 flex-col rounded-[4px] text-sm text-card-foreground",
        framed && "gap-1 border border-border bg-sidebar p-1",
        panel &&
          "overflow-hidden border border-border/80 bg-card shadow-card transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] motion-reduce:transition-none",
        variant === "plain" && "overflow-hidden bg-card ring-1 ring-foreground/10",
        !framed && accent && accentClass[accent],
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div
          data-slot="card-header"
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5",
            framed && "min-h-10 px-3 pb-2 pt-3",
            panel && "min-h-10 bg-card px-3 pb-2 pt-3",
            variant === "plain" && "px-3 pt-2.5 pb-0",
          )}
        >
          {title && (
            <h3
              data-slot="card-title"
              className={cn(
                "flex min-w-0 max-w-full items-center gap-2 truncate font-semibold tracking-tight text-foreground",
                "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75] [&_svg]:text-muted-foreground",
                framed && "text-sm",
                panel && "text-sm leading-snug",
                variant === "plain" && "text-sm font-medium leading-snug",
              )}
            >
              {title}
            </h3>
          )}
          {actions && (
            <div
              data-slot="card-action"
              className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            >
              {actions}
            </div>
          )}
        </div>
      )}
      <div
        data-slot="card-content"
        className={cn(
          "min-w-0",
          framed &&
            "grow overflow-hidden rounded-[4px] border border-border bg-card shadow-xs",
          framed && accent && accentClass[accent],
          flush &&
            "[&_[data-slot=data-grid]]:rounded-none [&_[data-slot=data-grid]]:border-0",
          !flush &&
            (panel
              ? "p-4"
              : hasHeader
                ? "px-4 pb-4 pt-3"
                : "p-4"),
        )}
      >
        {children}
      </div>
      {footer && (
        <div
          data-slot="card-footer"
          className={cn(
            "text-xs text-muted-foreground",
            framed ? "px-3 py-1" : "border-t border-border px-3 py-2",
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
