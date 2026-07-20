import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — what a list/section shows when there is no data yet. Pair it
 * with a real create/import action; never explain what the feature "will" do.
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
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground [&>svg]:size-8">{icon}</div>}
      <p className="typo-label text-foreground">{title}</p>
      {description && (
        <p className="typo-body max-w-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
