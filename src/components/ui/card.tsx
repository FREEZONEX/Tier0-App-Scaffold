import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card — the standard raised surface (DESIGN.md panel recipe): white on the
 * off-white canvas, hairline border, subtle elevation. Use for content
 * groupings; use plain divs for in-card sections.
 *
 * `accent` draws a 3px status bar on the left edge — the sanctioned way to
 * mark a card's risk/status. Never tint a whole card border with a status
 * color; pair the accent with a StatusBadge instead.
 */
export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  accent?: "running" | "paused" | "error" | "info";
  /** Remove default body padding (e.g. to place a table flush). */
  flush?: boolean;
}

const accentClass: Record<NonNullable<CardProps["accent"]>, string> = {
  running: "border-l-[3px] border-l-[color:var(--state-running-fg)]",
  paused: "border-l-[3px] border-l-[color:var(--state-paused-fg)]",
  error: "border-l-[3px] border-l-[color:var(--state-error-fg)]",
  info: "border-l-[3px] border-l-[color:var(--state-info-fg)]",
};

export function Card({
  title,
  actions,
  footer,
  accent,
  flush = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        accent && accentClass[accent],
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border-secondary px-4 py-2.5">
          {title && (
            <h3 className="typo-label min-w-0 truncate text-foreground">
              {title}
            </h3>
          )}
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className={cn(flush ? "" : "p-4")}>{children}</div>
      {footer && (
        <div className="border-t border-border-secondary px-4 py-2.5">
          {footer}
        </div>
      )}
    </div>
  );
}
