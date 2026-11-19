"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { useUiText } from "@/lib/locale";
import { Dialog, type DialogProps } from "@/components/overlays/dialog";
import { OverlayActionButton } from "@/components/overlays/overlay-frame";

export interface FormDialogProps
  extends Omit<DialogProps, "children" | "footer"> {
  children: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  /**
   * Disables footer actions only. Esc, backdrop and header-close dismissal
   * remain controlled by onOpenChange. Guard closing there while pending when
   * the workflow requires it; otherwise retain operation state after dismissal.
   * Closing does not cancel a submitted request. The caller handles async errors.
   */
  pending?: boolean;
  submitVariant?: "primary" | "highlight";
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export function FormDialog({
  children,
  submitLabel,
  cancelLabel,
  pending = false,
  submitVariant = "primary",
  onSubmit,
  onOpenChange,
  ...dialogProps
}: FormDialogProps) {
  const formId = useId();
  const uiText = useUiText();

  return (
    <Dialog
      {...dialogProps}
      onOpenChange={onOpenChange}
      footer={
        <>
          <OverlayActionButton
            action={{ label: cancelLabel ?? uiText("cancel"), variant: "outline", disabled: pending }}
            onDefaultClick={() => onOpenChange(false)}
          />
          <OverlayActionButton
            action={{
              label: submitLabel ?? uiText("save"),
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
        className="grid min-w-0 gap-4 [&>*]:min-w-0"
        onSubmit={(event) => void onSubmit(event)}
      >
        {children}
      </form>
    </Dialog>
  );
}
