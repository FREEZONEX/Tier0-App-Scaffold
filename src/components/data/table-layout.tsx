import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/**
 * DataTable — the default way to render an entity list: a white Card-style
 * surface with a horizontal-scroll viewport and a full-width table. Column
 * padding, header treatment, row dividers and hover come from the global
 * base table styles, so rows never cram together. Compose normal
 * thead/tbody/tr/th/td inside.
 *
 *   <DataTable>
 *     <thead><tr><th>批号</th><th>物料</th>…</tr></thead>
 *     <tbody>…</tbody>
 *   </DataTable>
 */
export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Remove the raised card frame (e.g. when already inside a Card). */
  bare?: boolean;
}

export function DataTable({ bare = false, className, children, ...props }: DataTableProps) {
  return (
    <div
      data-table-scroll="true"
      className={cn(
        "w-full overflow-x-auto",
        !bare && "rounded-lg border border-border bg-card shadow-sm",
      )}
    >
      <table className={cn("w-full", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export type TableViewportProps = HTMLAttributes<HTMLDivElement>;

export function TableViewport({ className, children, ...props }: TableViewportProps) {
  return (
    <div
      data-table-scroll="true"
      className={cn("w-full overflow-x-auto", className)}
      {...props}
    >
      <div className="min-w-[720px]">{children}</div>
    </div>
  );
}

export interface TableCellTextProps extends HTMLAttributes<HTMLDivElement> {
  clamp?: boolean;
}

export function TableCellText({
  className,
  clamp = false,
  children,
  ...props
}: TableCellTextProps) {
  return (
    <div
      className={cn(
        "min-w-0 align-top leading-snug",
        clamp ? "line-clamp-2" : "break-words",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type TableStatusCellProps = TdHTMLAttributes<HTMLTableCellElement>;

export function TableStatusCell({ className, children, ...props }: TableStatusCellProps) {
  return (
    <td className={cn("align-top whitespace-nowrap", className)} {...props}>
      {children}
    </td>
  );
}
