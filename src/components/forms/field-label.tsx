"use client";

import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RequiredMarkProps {
  className?: string;
}

export function RequiredMark({ className }: RequiredMarkProps) {
  return (
    <span
      aria-hidden="true"
      data-required-marker="true"
      className={cn("required-mark", className)}
    >
      *
    </span>
  );
}

export interface FieldLabelProps
  extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
}

export function FieldLabel({
  children,
  className,
  required = false,
  ...props
}: FieldLabelProps) {
  return (
    <label
      {...props}
      data-required={required ? "true" : undefined}
      data-required-rendered={required ? "true" : undefined}
      className={cn(
        "field-label typo-label inline-flex items-center gap-1 text-foreground",
        className,
      )}
    >
      <span>{children}</span>
      {required ? <RequiredMark /> : null}
    </label>
  );
}
