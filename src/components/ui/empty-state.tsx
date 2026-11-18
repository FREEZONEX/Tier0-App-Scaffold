import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENTER_RISE } from "@/lib/interaction";

/**
 * EmptyState — the shared chrome for empty, filter-miss, and forbidden
 * surfaces. Main work areas use the default dashed ring; nested cards and
 * board columns use `size="sm"` (no extra ring, no default icon).
 *
 * Pass a working `action` (outline or primary Button). Do not invent
 * promise copy. Forbidden views use this same shell — never a separate
 * "permission page".
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** A working action (e.g. <Button>新建物料</Button>), not promise copy. */
  action?: ReactNode;
  /**
   * `md` (default) is the main work-surface empty. `sm` sits inside an
   * already-bordered Card / board column: no dashed ring, tighter padding.
   */
  size?: "md" | "sm";
  /** Skip the muted icon tile (e.g. a mark that already has its own shape). */
  plainIcon?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  plainIcon = false,
  className,
}: EmptyStateProps) {
  const compact = size === "sm";

  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-col items-center justify-center text-center text-balance",
        compact ? "gap-2 px-3 py-6" : "gap-4 rounded-[4px] border border-dashed border-border px-6 py-12",
        ENTER_RISE,
        className,
      )}
    >
      {!compact || icon ? (
        <div
          data-slot="empty-icon"
          className={
            plainIcon
              ? "inline-flex shrink-0 items-center justify-center"
              : "inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-muted text-foreground [&>svg]:size-4"
          }
        >
          {icon ?? <Inbox aria-hidden="true" />}
        </div>
      ) : null}
      <div data-slot="empty-header" className="flex max-w-sm flex-col items-center gap-2">
        <div
          data-slot="empty-title"
          className="text-sm font-medium tracking-tight text-foreground"
        >
          {title}
        </div>
        {description && (
          <div
            data-slot="empty-description"
            className="text-sm/relaxed text-muted-foreground"
          >
            {description}
          </div>
        )}
      </div>
      {action && <div data-slot="empty-content">{action}</div>}
    </div>
  );
}
