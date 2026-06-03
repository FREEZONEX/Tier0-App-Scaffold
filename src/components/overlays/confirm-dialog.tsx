"use client";

import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/overlays/dialog";
import { OverlayActionButton } from "@/components/overlays/overlay-frame";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
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
      <div className="flex gap-3 rounded-sm border border-border bg-surface-inset p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-state-paused-fg" />
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </Dialog>
  );
}
