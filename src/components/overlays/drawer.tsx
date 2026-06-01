"use client";

import { useId } from "react";
import {
  OverlayFooter,
  OverlayHeader,
  OverlayPortal,
  useOverlayLifecycle,
  type OverlayFrameProps,
} from "@/components/overlays/overlay-frame";
import { cn } from "@/lib/utils";

export type DrawerSide = "right" | "left";
export type DrawerSize = "sm" | "md" | "lg";

const widthBySize: Record<DrawerSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
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

  return (
    <OverlayPortal open={open}>
      <div
        className={cn(
          "fixed inset-0 z-50 flex min-h-dvh bg-primary/35",
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
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "flex h-dvh w-full flex-col overflow-hidden border-border bg-card text-card-foreground shadow-xl",
            side === "right" ? "border-l" : "border-r",
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
              "page-y-scroll min-h-0 flex-1 px-6 py-6 sm:px-8",
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
