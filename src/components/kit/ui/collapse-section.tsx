"use client";

import { useId, useState, type ReactNode } from "react";
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

/** CollapseSection — 「▼ 基础信息」 form / detail section with animated collapse. */
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

  return (
    <section data-anchor-key={anchorKey} className={cn("min-w-0", className)}>
      <div className={cn("flex min-h-9 items-center gap-2", headerClassName)}>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            className="group -ml-1 inline-flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-1 text-left text-[15px] font-semibold leading-6 text-foreground hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-border"
            onClick={() => {
              setSettled(false);
              setOpen(!isOpen);
            }}
          >
            <svg
              viewBox="0 0 10 10"
              aria-hidden="true"
              className={cn(
                "size-2.5 shrink-0 fill-current text-text-secondary transition-transform duration-200 group-hover:text-brand",
                !expanded && "-rotate-90",
              )}
            >
              <path d="M1 3h8L5 8z" />
            </svg>
            <span className="min-w-0 truncate">{title}</span>
          </button>
        ) : (
          <h3 className="min-w-0 truncate text-[15px] font-semibold leading-6 text-foreground">{title}</h3>
        )}
        {extra ? <div className="ml-auto flex shrink-0 items-center gap-2">{extra}</div> : null}
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
          className={cn("min-h-0 min-w-0", expanded && settled ? "overflow-visible" : "overflow-hidden")}
          inert={!expanded || undefined}
        >
          <div className={cn("pt-2", contentClassName)}>{children}</div>
        </div>
      </div>
    </section>
  );
}
