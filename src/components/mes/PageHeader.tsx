"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { type ReactNode } from "react";

/**
 * PageHeader — structured page top with title, breadcrumbs, description, and action slot.
 * Gives pages a clear identity and breaks the "cards from row 1" pattern.
 *
 * Usage:
 *   <PageHeader
 *     title="Work Orders"
 *     description="Manage production scheduling and tracking"
 *     breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Work Orders" }]}
 *     actions={<Button>Create Order</Button>}
 *   />
 */

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Breadcrumb trail. Last item is current page (no link). */
  breadcrumbs?: Breadcrumb[];
  /** Optional badge next to title — e.g. a StateBadge for entity detail pages */
  badge?: ReactNode;
  /** Action slot — buttons, filters, etc. aligned right */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b border-[var(--border)] pb-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href && !isLast ? (
                  <a href={crumb.href} className="transition-colors hover:text-foreground">
                    {crumb.label}
                  </a>
                ) : (
                  <span className={isLast ? "text-foreground font-medium" : ""}>
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
