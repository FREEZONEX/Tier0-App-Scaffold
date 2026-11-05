import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — compact page opening: optional eyebrow kicker, title, and a
 * right-side actions slot for the page's primary action.
 *
 * The eyebrow uses the deep brand green (readable on white); raw highlight
 * lime is a fill color, never small text. Eyebrow copy uses the app locale
 * like all product copy.
 */
export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 pb-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6",
        className,
      )}
    >
      <div className="min-w-0 animate-[tier0-rise_220ms_var(--motion-spring)]">
        {eyebrow && (
          <p className="caption mb-1.5 font-semibold uppercase tracking-[0.14em] text-accent-strong">
            {eyebrow}
          </p>
        )}
        <h1 className="typo-h3 text-balance tracking-tight text-foreground">{title}</h1>
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
