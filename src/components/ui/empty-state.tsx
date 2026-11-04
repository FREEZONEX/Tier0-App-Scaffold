import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENTER_RISE } from "@/lib/interaction";

/**
 * EmptyState — ReUI empty surface recipe (dashed ring + 4px), Tier0 colors.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** A working action (e.g. <Button>新建物料</Button>), not promise copy. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-col items-center justify-center gap-4 rounded-[4px] border border-dashed border-border px-6 py-12 text-center text-balance",
        ENTER_RISE,
        className,
      )}
    >
      <div
        data-slot="empty-icon"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-muted text-foreground [&>svg]:size-4"
      >
        {icon ?? <Inbox aria-hidden="true" />}
      </div>
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
