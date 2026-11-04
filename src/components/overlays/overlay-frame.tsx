"use client";

import { type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type { OverlaySize } from "./overlay-lifecycle";

export interface OverlayAction {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
  variant?:
    | "primary"
    | "highlight"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive";
  disabled?: boolean;
  loading?: boolean;
}

export interface OverlayFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  contentClassName?: string;
  overlayClassName?: string;
  labelledById?: string;
  describedById?: string;
}

export function OverlayPortal({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function OverlayHeader({
  title,
  description,
  titleId,
  descriptionId,
  onClose,
  closeButtonRef,
}: {
  title: ReactNode;
  description?: ReactNode;
  titleId: string;
  descriptionId: string;
  onClose: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-0">
      <div className="min-w-0 flex-1 space-y-1.5">
        <h2
          id={titleId}
          className="text-lg font-semibold leading-6 tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <div
            id={descriptionId}
            className="text-sm leading-5 text-muted-foreground"
          >
            {description}
          </div>
        ) : null}
      </div>
      <Button
        ref={closeButtonRef}
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Close"
        className="size-8 shrink-0 px-0 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        icon={<X className="size-4" />}
      />
    </div>
  );
}

export function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col-reverse gap-2 px-5 pt-4 pb-5 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

export function OverlayActionButton({
  action,
  onDefaultClick,
}: {
  action: OverlayAction;
  onDefaultClick?: () => void;
}) {
  const variant =
    action.variant === "destructive"
      ? "danger"
      : action.variant === "primary"
        ? "primary"
        : action.variant === "highlight"
          ? "highlight"
          : action.variant === "secondary"
            ? "secondary"
            : action.variant === "ghost"
              ? "ghost"
              : "outline";

  return (
    <Button
      type={action.type ?? "button"}
      form={action.form}
      variant={variant}
      size="md"
      disabled={action.disabled}
      loading={action.loading}
      onClick={action.onClick ?? onDefaultClick}
    >
      {action.label}
    </Button>
  );
}
