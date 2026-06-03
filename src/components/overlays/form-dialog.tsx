"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { Dialog, type DialogProps } from "@/components/overlays/dialog";
import { OverlayActionButton } from "@/components/overlays/overlay-frame";

export interface FormDialogProps
  extends Omit<DialogProps, "children" | "footer"> {
  children: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  submitVariant?: "primary" | "highlight";
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export function FormDialog({
  children,
  submitLabel = "保存",
  cancelLabel = "取消",
  pending = false,
  submitVariant = "primary",
  onSubmit,
  onOpenChange,
  ...dialogProps
}: FormDialogProps) {
  const formId = useId();

  return (
    <Dialog
      {...dialogProps}
      onOpenChange={onOpenChange}
      footer={
        <>
          <OverlayActionButton
            action={{ label: cancelLabel, variant: "outline", disabled: pending }}
            onDefaultClick={() => onOpenChange(false)}
          />
          <OverlayActionButton
            action={{
              label: submitLabel,
              type: "submit",
              form: formId,
              variant: submitVariant,
              loading: pending,
            }}
          />
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-4"
        onSubmit={(event) => void onSubmit(event)}
      >
        {children}
      </form>
    </Dialog>
  );
}
