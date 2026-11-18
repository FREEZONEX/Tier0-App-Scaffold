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
import { EXIT_MS, usePresence } from "@/lib/presence";
import { ENTER_FADE, ENTER_POP, EXIT_FADE, EXIT_POP } from "@/lib/interaction";

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
  const presence = usePresence(open, EXIT_MS.base);

  return (
    <OverlayPortal open={presence.mounted}>
      <div
        data-state={presence.state}
        className={cn(
          "fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-black/40 p-3 sm:p-6",
          "supports-[backdrop-filter]:bg-black/30 supports-[backdrop-filter]:backdrop-blur-[2px]",
          ENTER_FADE,
          EXIT_FADE,
          size === "full" && "p-0 sm:p-0",
          overlayClassName,
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && closeOnOverlayClick) {
            onOpenChange(false);
          }
        }}
      >
        <section
          data-state={presence.state}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description || describedById ? descriptionId : undefined}
          className={cn(
            "relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[4px] bg-popover text-sm text-popover-foreground shadow-[var(--shadow-overlay)] ring-1 ring-foreground/10 sm:max-h-[calc(100dvh-3rem)]",
            ENTER_POP,
            EXIT_POP,
            overlayWidthClass(size),
            size === "full" && "h-dvh max-h-dvh rounded-none sm:max-h-dvh",
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
              "page-y-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden px-5 pt-4",
              footer ? "pb-1" : "pb-5",
              "[&_[data-field-group]]:w-full [&_input]:max-w-none [&_input]:w-full",
              contentClassName,
            )}
          >
            <div className="space-y-4">{children}</div>
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
