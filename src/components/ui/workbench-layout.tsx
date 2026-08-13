import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ResponsivePage } from "./responsive-page";

/**
 * WorkbenchLayout — the safe page-root composition for management workspaces.
 * It keeps KPIs as a compact summary and gives the real work most of the page:
 * a primary queue/table plus an optional secondary risk or decision surface.
 *
 * Put PageHeader in `header`, StatCards in `metrics`, and the primary work
 * surface in `children`. At wide breakpoints the optional `aside` becomes a
 * restrained 2:1 column; on smaller screens every region stacks naturally.
 */
export interface WorkbenchLayoutProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  header: ReactNode;
  metrics?: ReactNode;
  aside?: ReactNode;
  below?: ReactNode;
  children: ReactNode;
}

export function WorkbenchLayout({
  header,
  metrics,
  aside,
  below,
  className,
  children,
  ...props
}: WorkbenchLayoutProps) {
  return (
    <ResponsivePage
      className={cn(className)}
      {...props}
    >
      {header}

      {metrics && (
        <section className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
          {metrics}
        </section>
      )}

      <div
        className={cn(
          "grid min-w-0 items-start gap-4",
          aside &&
            "xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]",
        )}
      >
        <section className="min-w-0">{children}</section>
        {aside && <aside className="min-w-0">{aside}</aside>}
      </div>

      {below}
    </ResponsivePage>
  );
}
