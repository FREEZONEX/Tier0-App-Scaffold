"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * EmptyState — visually rich empty placeholder with icon, message, and action.
 * Replaces the boring "No data" one-liners across all list/table views.
 *
 * Usage:
 *   <EmptyState
 *     title="No work orders"
 *     description="Create your first work order to get started."
 *     action={<Button onClick={...}>Create Order</Button>}
 *   />
 *
 *   <EmptyState icon={Package} title="No inventory items" />
 */

interface EmptyStateProps {
  /** Primary message */
  title: string;
  /** Supporting description */
  description?: string;
  /** Icon component. Default: Inbox */
  icon?: React.ComponentType<{ className?: string }>;
  /** Action slot — typically a create button */
  action?: ReactNode;
  /** Compact mode — less padding, smaller icon. For inline empty states in cards. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      <div className={cn(
        "flex items-center justify-center rounded-xl bg-gray-50 border border-[var(--border)]",
        compact ? "h-10 w-10 mb-3" : "h-14 w-14 mb-4"
      )}>
        <Icon className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-6 w-6")} />
      </div>

      <h3 className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
        {title}
      </h3>

      {description && (
        <p className={cn(
          "mt-1 max-w-[280px] text-muted-foreground",
          compact ? "text-[10px]" : "text-xs"
        )}>
          {description}
        </p>
      )}

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
