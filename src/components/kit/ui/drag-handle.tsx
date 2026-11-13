"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DragHandleProps {
  disabled?: boolean;
  className?: string;
}

/** Shared reorder handle: one size, tone and pointer state across every editor. */
export function DragHandle({ disabled = false, className }: DragHandleProps) {
  return (
    <GripVertical
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 text-text-placeholder transition-colors",
        disabled ? "opacity-40" : "cursor-grab hover:text-muted-foreground active:cursor-grabbing",
        className,
      )}
    />
  );
}

/** Insertion marker used by list and table reordering. */
export function dragInsertionClass(edge: "before" | "after", cells = false): string {
  if (cells) {
    return edge === "before"
      ? "[&>td]:border-t-2 [&>td]:border-t-foreground"
      : "[&>td]:border-b-2 [&>td]:border-b-foreground";
  }
  return edge === "before"
    ? "before:absolute before:inset-x-1 before:-top-px before:z-10 before:h-0.5 before:rounded-full before:bg-[color:var(--tier0-highlight-deep)]"
    : "after:absolute after:inset-x-1 after:-bottom-px after:z-10 after:h-0.5 after:rounded-full after:bg-[color:var(--tier0-highlight-deep)]";
}
