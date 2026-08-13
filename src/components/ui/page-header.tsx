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
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="caption mb-1 font-semibold uppercase tracking-wider text-accent-strong">
            {eyebrow}
          </p>
        )}
        <h1 className="typo-h3 text-foreground">{title}</h1>
      </div>
      {actions && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end [&>*]:max-w-full">
          {actions}
        </div>
      )}
    </div>
  );
}
