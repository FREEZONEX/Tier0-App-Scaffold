import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ResponsivePage — the safe root for ordinary workspace pages. It owns the
 * compact mobile padding, wider-screen breathing room, and min-width guards
 * required for browser zoom to reflow instead of creating page overflow.
 */
export type ResponsivePageProps = HTMLAttributes<HTMLDivElement>;

export function ResponsivePage({
  className,
  children,
  ...props
}: ResponsivePageProps) {
  return (
    <div
      data-responsive-page="true"
      className={cn(
        "page-shell space-y-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PageToolbarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Search, filters, and view controls. */
  children?: ReactNode;
  /** Create/export/bulk actions; wraps below filters when space is tight. */
  actions?: ReactNode;
}

/**
 * PageToolbar — responsive filter/action composition. At narrow widths and
 * high browser zoom, actions move below the filters instead of shrinking the
 * controls or pushing the page wider than the viewport.
 */
export function PageToolbar({
  children,
  actions,
  className,
  ...props
}: PageToolbarProps) {
  return (
    <div
      data-page-toolbar="true"
      className={cn(
        "flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      {children && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
      {actions && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>*]:max-w-full">
          {actions}
        </div>
      )}
    </div>
  );
}
