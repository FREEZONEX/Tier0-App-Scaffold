"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  TOOLTIP_Z_INDEX,
  useFloatingPosition,
  useHoverIntent,
  type Placement,
} from "@/components/kit/ui/floating";
import { FloatingLayer } from "@/components/kit/ui/layer";

export interface TooltipProps {
  /** Tooltip content; empty content disables the tooltip. */
  title: ReactNode;
  children: ReactNode;
  placement?: Placement;
  disabled?: boolean;
  /** Only open when this returns true for the trigger element (e.g. overflow check). */
  when?: (anchor: HTMLElement) => boolean;
  openDelay?: number;
  /** Panel class. */
  className?: string;
  /** Trigger wrapper class (default inline-flex). */
  anchorClassName?: string;
}

/** Tooltip — dark hint bubble on hover / keyboard focus. */
export function Tooltip({
  title,
  children,
  placement = "top",
  disabled = false,
  when,
  openDelay = 120,
  className,
  anchorClassName,
}: TooltipProps) {
  const layerId = useId();
  const tooltipId = `${layerId}-tip`;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const hasTitle = title !== null && title !== undefined && title !== "" && title !== false;
  const visible = open && hasTitle && !disabled;

  const hover = useHoverIntent(
    (next) => {
      if (next && anchorRef.current && when && !when(anchorRef.current)) return;
      setOpen(next);
    },
    { openDelay, closeDelay: 60 },
  );
  const position = useFloatingPosition({
    open: visible,
    anchorRef,
    floatingRef,
    placement,
    offset: 6,
    zIndex: TOOLTIP_Z_INDEX,
  });

  return (
    <>
      <span
        ref={anchorRef}
        aria-describedby={visible ? tooltipId : undefined}
        className={cn("inline-flex max-w-full", anchorClassName)}
        onMouseEnter={hover.onEnter}
        onMouseLeave={hover.onLeave}
        onFocus={hover.onEnter}
        onBlur={hover.onLeave}
        onMouseDown={() => setOpen(false)}
      >
        {children}
      </span>
      <FloatingLayer
        open={visible}
        layerId={layerId}
        floatingRef={floatingRef}
        style={position.style}
        placement={position.placement}
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none max-w-[min(320px,calc(100vw-16px))] break-words rounded-md bg-[rgb(0_0_0/0.85)] px-2 py-1.5 text-xs leading-5 text-white shadow-popup",
          className,
        )}
      >
        {title}
      </FloatingLayer>
    </>
  );
}

export interface EllipsisTextProps {
  children: ReactNode;
  /** Tooltip content when truncated (defaults to children). */
  title?: ReactNode;
  lines?: 1 | 2 | 3;
  placement?: Placement;
  /** Class for the clamped text span. */
  className?: string;
}

function textOverflows(anchor: HTMLElement): boolean {
  const element = anchor.firstElementChild;
  if (!(element instanceof HTMLElement)) return false;
  return (
    element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
  );
}

/** EllipsisText — clamps text and shows the full text in a tooltip only when it overflows. */
export function EllipsisText({ children, title, lines = 1, placement = "top", className }: EllipsisTextProps) {
  return (
    <Tooltip
      title={title ?? children}
      placement={placement}
      when={textOverflows}
      anchorClassName="flex min-w-0 max-w-full"
    >
      <span
        className={cn("min-w-0", lines === 1 ? "block truncate" : "break-words", className)}
        style={
          lines === 1
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }
      >
        {children}
      </span>
    </Tooltip>
  );
}
