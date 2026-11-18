"use client";

import { useId } from "react";
import {
  OverlayFooter,
  OverlayHeader,
  OverlayPortal,
  type OverlayFrameProps,
} from "@/components/overlays/overlay-frame";
import { useOverlayLifecycle } from "@/components/overlays/overlay-lifecycle";
import { cn } from "@/lib/utils";
import { EXIT_MS, usePresence } from "@/lib/presence";
import {
  ENTER_DRAWER_LEFT,
  ENTER_DRAWER_RIGHT,
  ENTER_FADE,
  EXIT_DRAWER_LEFT,
  EXIT_DRAWER_RIGHT,
  EXIT_FADE,
} from "@/lib/interaction";

export type DrawerSide = "right" | "left";
export type DrawerSize = "sm" | "md" | "lg" | "xl" | "2xl";

const widthBySize: Record<DrawerSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-5xl",
  "2xl": "sm:max-w-7xl",
};

export interface DrawerProps extends OverlayFrameProps {
  side?: DrawerSide;
  size?: DrawerSize;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  size = "md",
  initialFocusRef,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className,
  contentClassName,
  overlayClassName,
  labelledById,
  describedById,
}: DrawerProps) {
  const fallbackId = useId();
  const titleId = labelledById ?? `${fallbackId}-title`;
  const descriptionId = describedById ?? `${fallbackId}-description`;
  const { closeButtonRef } = useOverlayLifecycle({
    open,
    onOpenChange,
    initialFocusRef,
    closeOnEsc,
  });
  const presence = usePresence(open, EXIT_MS.drawer);

  return (
    <OverlayPortal open={presence.mounted}>
      <div
        data-state={presence.state}
        className={cn(
          "fixed inset-0 z-50 flex min-h-dvh bg-black/40",
          "supports-[backdrop-filter]:bg-black/30 supports-[backdrop-filter]:backdrop-blur-[2px]",
          ENTER_FADE,
          EXIT_FADE,
          side === "right" ? "justify-end" : "justify-start",
          overlayClassName,
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && closeOnOverlayClick) {
            onOpenChange(false);
          }
        }}
      >
        <aside
          data-state={presence.state}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description || describedById ? descriptionId : undefined}
          className={cn(
            "relative flex h-dvh w-full flex-col overflow-hidden bg-popover text-sm text-popover-foreground shadow-[var(--shadow-overlay)] ring-1 ring-foreground/10",
            side === "right" ? "border-l border-border/70" : "border-r border-border/70",
            side === "right"
              ? cn(ENTER_DRAWER_RIGHT, EXIT_DRAWER_RIGHT)
              : cn(ENTER_DRAWER_LEFT, EXIT_DRAWER_LEFT),
            widthBySize[size],
            className,
          )}
        >
          <OverlayHeader
            title={title}
            description={description}
            titleId={titleId}
            descriptionId={descriptionId}
            onClose={() => onOpenChange(false)}
            closeButtonRef={closeButtonRef}
          />
          <div
            className={cn(
              "page-y-scroll min-h-0 min-w-0 flex-1 flex-1 overflow-x-hidden px-4 py-4 sm:px-5",
              contentClassName,
            )}
          >
            {children}
          </div>
          {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
        </aside>
      </div>
    </OverlayPortal>
  );
}
