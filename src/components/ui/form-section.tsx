"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

/**
 * FormSection — structured form region with title, description, and a field grid.
 * Gives CRUD form pages visual structure instead of flat input stacks.
 *
 * Usage:
 *   <FormSection title="General" description="Basic work order information">
 *     <Input ... />
 *     <Select ... />
 *   </FormSection>
 *
 *   <FormSection title="Scheduling" columns={2}>
 *     <div><Label>Start</Label><Input type="date" /></div>
 *     <div><Label>End</Label><Input type="date" /></div>
 *   </FormSection>
 */

interface FormSectionProps {
  /** Section title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Number of field columns. Default 1. */
  columns?: 1 | 2 | 3;
  /** Whether to show a divider below this section. Default true. */
  divider?: boolean;
  /** Field content */
  children: ReactNode;
  className?: string;
}

const gridCols = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function FormSection({
  title,
  description,
  columns = 1,
  divider = true,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn(divider && "border-b border-[var(--border)] pb-6", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      <div className={cn("grid gap-4", gridCols[columns])}>
        {children}
      </div>
    </section>
  );
}
