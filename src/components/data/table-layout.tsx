import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
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
 *
 * Alignment rules (keep th and td the same):
 * - text / identity: left (default)
 * - quantities and ranges: `TableNumericCell` / `TableNumericHeader` (right)
 * - status / actions / checkboxes: `table-col-fit`, left, vertically middle
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
        !bare && "rounded-[4px] border border-border bg-card shadow-sm",
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
  /** Optional secondary line under the primary text (codes, hints). */
  secondary?: ReactNode;
}

export function TableCellText({
  className,
  clamp = false,
  secondary,
  children,
  ...props
}: TableCellTextProps) {
  return (
    <div
      className={cn(
        "min-w-0 leading-snug",
        secondary ? "flex flex-col gap-0.5" : null,
        clamp ? "line-clamp-2" : "break-words",
        className,
      )}
      {...props}
    >
      <div className={cn(clamp && secondary ? "line-clamp-2" : null)}>{children}</div>
      {secondary ? <div className="caption font-mono">{secondary}</div> : null}
    </div>
  );
}

export type TableNumericHeaderProps = ThHTMLAttributes<HTMLTableCellElement>;

/** Right-aligned header for quantity / amount / range columns. */
export function TableNumericHeader({ className, children, ...props }: TableNumericHeaderProps) {
  return (
    <th className={cn("text-right", className)} {...props}>
      {children}
    </th>
  );
}

export type TableNumericCellProps = TdHTMLAttributes<HTMLTableCellElement>;

/** Right-aligned body cell for quantities; matches `TableNumericHeader`. */
export function TableNumericCell({ className, children, ...props }: TableNumericCellProps) {
  return (
    <td className={cn("text-right tabular-nums whitespace-nowrap", className)} {...props}>
      {children}
    </td>
  );
}

export interface TableStatusCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /**
   * `middle` (default) lines the badge up with one- or two-line rows; use
   * `top` when sibling cells wrap long paragraphs so the badge stays on the
   * first line.
   */
  valign?: "middle" | "top";
}

/** Status / badge column: content-width, never wraps. */
export function TableStatusCell({ valign = "middle", className, children, ...props }: TableStatusCellProps) {
  return (
    <td
      className={cn(
        "table-col-fit whitespace-nowrap",
        valign === "top" ? "align-top" : "align-middle",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
