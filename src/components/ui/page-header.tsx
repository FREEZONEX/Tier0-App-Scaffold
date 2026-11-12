import type { ReactNode } from "react";
import { BackButton, type BackTarget } from "@/components/ui/back-button";
import { cn } from "@/lib/utils";

/**
 * PageHeader — compact page opening: optional back button, optional short
 * eyebrow, title, and a right-side actions slot for the page's primary action.
 *
 * Every page below a navigation entry (detail, sub-page, task page) passes
 * `back` with its parent level; top-level pages reached from the sidebar
 * don't.
 *
 * Do not use `eyebrow` for long record metadata (recipe, SKU, path, …). Put
 * those fields in the page's info Card. Eyebrow is only for a short workspace
 * category (a few characters), never a second title line.
 */
export interface PageHeaderProps {
  /** Short category kicker only — not record metadata. */
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  /** Parent level for the back button left of the title. */
  back?: BackTarget;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  actions,
  back,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 pb-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3 animate-[tier0-rise_220ms_var(--motion-spring)]">
        {back ? <BackButton {...back} /> : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="typo-h3 text-balance tracking-tight text-foreground">{title}</h1>
        </div>
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
