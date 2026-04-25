"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useRef } from "react";
import { motion } from "@/lib/motion";

/**
 * TimelineView — vertical timeline for audit logs, equipment events, etc.
 *
 * Usage:
 *   <TimelineView items={[
 *     { id: "1", timestamp: "14:32", title: "Work order released", description: "WO-2025-042 released by J. Chen", variant: "accent" },
 *     { id: "2", timestamp: "13:10", title: "Equipment fault", description: "CNC-03 spindle overtemp", variant: "destructive" },
 *   ]} />
 */

export interface TimelineItem {
  id: string;
  /** Displayed in the left gutter */
  timestamp: string;
  title: string;
  description?: string;
  /** Dot color variant */
  variant?: "default" | "accent" | "destructive" | "warning" | "success";
  /** Optional icon or element rendered inside the dot */
  icon?: ReactNode;
}

interface TimelineViewProps {
  items: TimelineItem[];
  className?: string;
}

const dotColors: Record<string, string> = {
  default: "bg-gray-400",
  accent: "bg-[var(--accent)]",
  destructive: "bg-red-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
};

export function TimelineView({ items, className }: TimelineViewProps) {
  const hasMounted = useRef(false);

  if (!items.length) {
    return <p className="py-8 text-center text-xs text-muted-foreground">No events</p>;
  }

  // Only animate on first mount
  const shouldAnimate = !hasMounted.current;
  if (!hasMounted.current) hasMounted.current = true;

  return (
    <div className={cn("relative", className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const variant = item.variant ?? "default";

        return (
          <motion.div
            key={item.id}
            className="flex gap-3"
            initial={shouldAnimate ? { opacity: 0, x: -12 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: shouldAnimate ? idx * 0.03 : 0, duration: 0.25, ease: "easeOut" }}
          >
            {/* Timestamp gutter */}
            <div className="w-14 shrink-0 pt-0.5 text-right text-[10px] text-muted-foreground">
              {item.timestamp}
            </div>

            {/* Dot + line */}
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full",
                  dotColors[variant]
                )}
              >
                {item.icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-200" />}
            </div>

            {/* Content */}
            <div className={cn("pb-5", isLast && "pb-0")}>
              <p className="text-xs font-medium leading-tight">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
