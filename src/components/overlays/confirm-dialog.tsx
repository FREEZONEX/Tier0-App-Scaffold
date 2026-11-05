"use client";

import { useId } from "react";
import { AlertTriangle } from "lucide-react";
import { uiText } from "@/lib/app-chrome";
import { Dialog } from "@/components/overlays/dialog";
import { OverlayActionButton } from "@/components/overlays/overlay-frame";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Disables footer actions only. Esc, backdrop and header-close dismissal
   * remain controlled by onOpenChange. Guard closing there while pending when
   * the workflow requires it; otherwise retain operation state after dismissal.
   * Closing does not cancel a submitted request. The caller handles async errors.
   */
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = uiText("confirm"),
  cancelLabel = uiText("cancel"),
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      describedById={descriptionId}
      contentClassName="py-5"
      footer={
        <>
          <OverlayActionButton
            action={{ label: cancelLabel, variant: "outline", disabled: pending }}
            onDefaultClick={() => onOpenChange(false)}
          />
          <OverlayActionButton
            action={{
              label: confirmLabel,
              variant: destructive ? "destructive" : "primary",
              loading: pending,
            }}
            onDefaultClick={() => void onConfirm()}
          />
        </>
      }
    >
      <div
        className={cn(
          "flex gap-3 rounded-[4px] border p-4",
          destructive
            ? "border-state-error-border bg-state-error-bg/70"
            : "border-border bg-surface-inset",
        )}
      >
        <span
          className={cn(
            "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] border",
            destructive
              ? "border-state-error-border bg-card text-state-error-fg"
              : "border-border bg-card text-state-paused-fg",
          )}
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <p id={descriptionId} className="text-sm leading-6 text-foreground/85">
          {description}
        </p>
      </div>
    </Dialog>
  );
}
