import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card — Tier0 panel: white surface, icon + title header over one hairline,
 * roomy body. Keeps the scaffold Card API (title / actions / footer / accent /
 * flush). Put a lucide icon before the title text; it renders muted.
 *
 * Variants: "panel" (default), "frame" (ReUI muted shell + inset panel for a
 * toolbar-heavy work surface), "plain" (single box for nested/small cards).
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
        framed && "gap-1 border border-border bg-fill-hover p-1",
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
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
            framed && "min-h-9 px-3 py-1.5",
            panel && "px-5 pt-4 pb-0",
            variant === "plain" && "px-4 pt-3.5 pb-0",
          )}
        >
          {title && (
            <h3
              data-slot="card-title"
              className={cn(
                "flex min-w-0 max-w-full items-center gap-2 truncate font-semibold tracking-tight text-foreground",
                "[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg]:stroke-[1.75]",
                framed && "text-sm",
                panel && "gap-2.5 text-base leading-snug",
                variant === "plain" && "text-base font-medium leading-snug",
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
              ? hasHeader
                ? "px-5 pb-5 pt-4"
                : "p-5"
              : hasHeader
                ? "px-4 pb-4 pt-3.5"
                : "p-4"),
          flush && hasHeader && (panel ? "pt-3.5" : "pt-3"),
        )}
      >
        {children}
      </div>
      {footer && (
        <div
          data-slot="card-footer"
          className={cn(
            "text-xs text-muted-foreground",
            framed ? "px-3 py-1.5" : "px-5 py-3",
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
