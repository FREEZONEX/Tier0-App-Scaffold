"use client";

import { useId } from "react";
import { uiText } from "@/lib/app-chrome";
import { Dialog } from "@/components/overlays/dialog";
import { OverlayActionButton } from "@/components/overlays/overlay-frame";
import { RiskBanner } from "@/components/ui/risk-banner";

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
      <RiskBanner severity={destructive ? "error" : "warning"}>
        <p id={descriptionId} className="text-sm leading-6">
          {description}
        </p>
      </RiskBanner>
    </Dialog>
  );
}
