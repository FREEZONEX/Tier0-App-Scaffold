"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FLOATING_PANEL_CLASS } from "@/components/kit/ui/control-styles";
import {
  useControllableState,
  useFloatingPosition,
  useHoverIntent,
  useLayerDismiss,
  type Placement,
} from "@/components/kit/ui/floating";
import { FloatingLayer } from "@/components/kit/ui/layer";

export interface PopoverProps {
  /** Panel content; the function form receives `close()`. */
  content: ReactNode | ((api: { close: () => void }) => ReactNode);
  /** Optional bold title above the content. */
  title?: ReactNode;
  /** The trigger (wrapped in an inline-flex span). */
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** click (default) · hover · manual (only `open` controls it). */
  trigger?: "click" | "hover" | "manual";
  placement?: Placement;
  offset?: number;
  /** Panel width follows the trigger (true) or is at least as wide ("min"). */
  sameWidth?: boolean | "min";
  disabled?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  /** Panel class (padding defaults to p-3). */
  className?: string;
  /** Trigger wrapper class, e.g. "w-full" for block triggers. */
  anchorClassName?: string;
  /** Accessible name of the panel. */
  "aria-label"?: string;
}

export function Popover({
  content,
  title,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  trigger = "click",
  placement = "bottom-start",
  offset = 8,
  sameWidth = false,
  disabled = false,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  className,
  anchorClassName,
  "aria-label": ariaLabel,
}: PopoverProps) {
  const layerId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const visible = isOpen && !disabled;
  const hover = useHoverIntent(setOpen);
  const position = useFloatingPosition({
    open: visible,
    anchorRef,
    floatingRef,
    placement,
    offset,
    sameWidth,
  });

  useLayerDismiss({
    open: visible,
    layerId,
    anchorRef,
    closeOnOutside: closeOnOutsideClick && trigger !== "manual",
    closeOnEscape,
    onDismiss: (reason) => {
      setOpen(false);
      if (reason === "escape") anchorRef.current?.querySelector<HTMLElement>("button, [tabindex], a, input")?.focus();
    },
  });

  const close = () => setOpen(false);

  return (
    <>
      <span
        ref={anchorRef}
        aria-haspopup="dialog"
        aria-expanded={visible}
        className={cn("inline-flex max-w-full", anchorClassName)}
        onClick={trigger === "click" && !disabled ? () => setOpen(!isOpen) : undefined}
        onMouseEnter={trigger === "hover" && !disabled ? hover.onEnter : undefined}
        onMouseLeave={trigger === "hover" && !disabled ? hover.onLeave : undefined}
        onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
          if (trigger === "hover" && !disabled && (event.key === "Enter" || event.key === " ")) {
            setOpen(!isOpen);
          }
        }}
      >
        {children}
      </span>
      <FloatingLayer
        open={visible}
        layerId={layerId}
        floatingRef={floatingRef}
        style={position.style}
        placement={position.placement}
        role="dialog"
        aria-label={ariaLabel}
        className={cn(FLOATING_PANEL_CLASS, "max-w-[calc(100vw-16px)] p-3", className)}
        onMouseEnter={trigger === "hover" ? hover.onEnter : undefined}
        onMouseLeave={trigger === "hover" ? hover.onLeave : undefined}
      >
        {title ? (
          <div className="mb-2 text-sm font-semibold leading-[22px] text-foreground">{title}</div>
        ) : null}
        {typeof content === "function" ? content({ close }) : content}
      </FloatingLayer>
    </>
  );
}
