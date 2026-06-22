"use client";

import { type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5 sm:px-8 sm:py-6">
      <div className="min-w-0">
        <h2
          id={titleId}
          className="text-xl font-semibold leading-7 text-foreground sm:text-2xl sm:leading-8"
        >
          {title}
        </h2>
        {description ? (
          <div
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-muted-foreground"
          >
            {description}
          </div>
        ) : null}
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Close"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow-sm transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:text-foreground hover:shadow-md focus:border-highlight focus:outline-none"
        onClick={onClose}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-inset px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
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
  const variant = action.variant ?? "outline";

  return (
    <button
      type={action.type ?? "button"}
      form={action.form}
      disabled={action.disabled || action.loading}
      aria-busy={action.loading || undefined}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-sm border px-3.5 text-sm font-medium shadow-sm transition-[background-color,border-color,color,box-shadow] duration-150 hover:shadow-md disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        variant === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-[var(--tier0-primary-hover)]",
        variant === "highlight" &&
          "border-highlight-bg-primary bg-button-highlight text-accent-foreground hover:bg-highlight-bg-accent",
        variant === "secondary" &&
          "border-border bg-card text-foreground hover:border-border-strong hover:bg-background",
        variant === "outline" &&
          "border-border bg-background text-foreground hover:bg-surface-inset",
        variant === "ghost" &&
          "border-transparent bg-transparent text-muted-foreground hover:bg-surface-inset hover:text-foreground",
        variant === "destructive" &&
          "border-state-error-border bg-state-error-bg text-state-error-fg hover:border-state-error-fg",
      )}
      onClick={action.onClick ?? onDefaultClick}
    >
      {action.loading ? "Processing..." : action.label}
    </button>
  );
}
