"use client";

import { useId, type ReactNode } from "react";
import {
  OverlayFooter,
  OverlayHeader,
  OverlayPortal,
  type OverlayFrameProps,
} from "@/components/overlays/overlay-frame";
import {
  overlayWidthClass,
  useOverlayLifecycle,
  type OverlaySize,
} from "@/components/overlays/overlay-lifecycle";
import { cn } from "@/lib/utils";

export interface DialogProps extends OverlayFrameProps {
  size?: OverlaySize;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  initialFocusRef,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className,
  contentClassName,
  overlayClassName,
  labelledById,
  describedById,
}: DialogProps) {
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
          "fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-primary/35 p-3 sm:p-6",
          overlayClassName,
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && closeOnOverlayClick) {
            onOpenChange(false);
          }
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl sm:max-h-[calc(100dvh-3rem)]",
            overlayWidthClass(size),
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
              "page-y-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden px-6 py-6 sm:px-8",
              contentClassName,
            )}
          >
            {children}
          </div>
          {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
        </section>
      </div>
    </OverlayPortal>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
