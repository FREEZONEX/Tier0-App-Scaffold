import type { HTMLAttributes, TdHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

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
