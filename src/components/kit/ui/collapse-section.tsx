"use client";

import { useId, useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/components/kit/ui/floating";

export interface CollapseSectionProps {
  title: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Right side of the header (buttons, counts). */
  extra?: ReactNode;
  /** Marks the section for AnchorTabs (data-anchor-key). */
  anchorKey?: string;
  /** false = static title without the toggle caret. */
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

/** CollapseSection — 「▼ 基础信息」form / detail section with animated collapse. */
export function CollapseSection({
  title,
  open,
  defaultOpen = true,
  onOpenChange,
  extra,
  anchorKey,
  collapsible = true,
  children,
  className,
  headerClassName,
  contentClassName,
}: CollapseSectionProps) {
  const contentId = useId();
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const expanded = !collapsible || isOpen;
  const [settled, setSettled] = useState(expanded);
  useEffect(() => {
    // Also settle controlled changes and reduced-motion transitions, where
    // transitionend is not guaranteed to fire.
    const timer = setTimeout(() => setSettled(true), 220);
    return () => clearTimeout(timer);
  }, [expanded]);

  return (
    <section data-anchor-key={anchorKey} className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex min-h-10 items-center gap-2",
          headerClassName,
        )}
      >
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            className="group grid min-w-0 flex-1 grid-cols-[12px_minmax(0,1fr)] items-center gap-x-2 rounded-[4px] px-1.5 py-1.5 text-left text-[15px] font-semibold leading-6 text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:text-foreground"
            onClick={() => {
              setSettled(false);
              setOpen(!isOpen);
            }}
          >
            <svg
              viewBox="0 0 10 10"
              aria-hidden="true"
              className={cn(
                "size-3 justify-self-center fill-current text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                !expanded && "-rotate-90",
              )}
            >
              <path d="M1 3h8L5 8z" />
            </svg>
            <span className="min-w-0">{title}</span>
          </button>
        ) : (
          <h3 className="min-w-0 truncate text-[15px] font-semibold leading-6 text-foreground">
            {title}
          </h3>
        )}
        {extra ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">{extra}</div>
        ) : null}
      </div>
      <div
        id={contentId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget) setSettled(true);
        }}
      >
        <div
          className={cn(
            "min-h-0 min-w-0",
            expanded && settled ? "overflow-visible" : "overflow-hidden",
          )}
          inert={!expanded || undefined}
        >
          <div
            className={cn(
              "pb-3 pt-3",
              /* Same 12px + 8px gap as the header caret column → body under title */
              collapsible && "grid grid-cols-[12px_minmax(0,1fr)] gap-x-2",
              contentClassName,
            )}
          >
            {collapsible ? <span aria-hidden className="block" /> : null}
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
