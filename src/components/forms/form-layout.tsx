"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldLabel } from "./field-label";

export interface FieldGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  helperText?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  labelClassName?: string;
  controlClassName?: string;
}

export function FieldGroup({
  label,
  htmlFor,
  required = false,
  helperText,
  error,
  children,
  className,
  labelClassName,
  controlClassName,
  ...props
}: FieldGroupProps) {
  return (
    <div
      {...props}
      data-field-group="true"
      className={cn("grid min-w-0 content-start gap-1.5", className)}
    >
      {label ? (
        <FieldLabel
          htmlFor={htmlFor}
          required={required}
          className={labelClassName}
        >
          {label}
        </FieldLabel>
      ) : null}
      <div className={cn("min-w-0", controlClassName)}>{children}</div>
      {error ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs leading-5 text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

export interface FormGridProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  columns?: 1 | 2;
}

export function FormGrid({
  children,
  columns = 2,
  className,
  ...props
}: FormGridProps) {
  return (
    <div
      {...props}
      data-form-grid="true"
      className={cn(
        "grid min-w-0 grid-cols-1 items-start gap-4 [&>*]:min-w-0",
        columns === 2 && "md:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface LineItemSectionProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function LineItemSection({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: LineItemSectionProps) {
  return (
    <section
      {...props}
      data-line-item-section="true"
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-border bg-card",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 border-b border-border bg-surface-inset px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-6 text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="grid min-w-0 gap-3 p-4 [&>*]:min-w-0">{children}</div>
    </section>
  );
}
