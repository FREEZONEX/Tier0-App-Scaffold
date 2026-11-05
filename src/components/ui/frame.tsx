import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Frame — ReUI's layered surface: a muted shell that carries header/footer
 * chrome around one or more white inset panels. Use it to group a working
 * surface (table, board, feed) with its toolbar; plain content needs no frame.
 *
 *   <Frame>
 *     <FrameHeader><FrameTitle>最近动态</FrameTitle></FrameHeader>
 *     <FramePanel>…</FramePanel>
 *   </Frame>
 *
 * Adapted from ReUI (MIT, © 2025 Keenthemes Inc, github.com/keenthemes/reui):
 * spacing collapsed to one Tier0 scale, every corner 4px, Tier0 tokens only.
 */
export function Frame({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="frame"
      className={cn(
        "relative flex min-w-0 flex-col gap-1 rounded-[4px] border border-border bg-fill-hover p-1",
        className,
      )}
      {...props}
    />
  );
}

export function FramePanel({
  className,
  flush = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** Drop body padding for edge-to-edge tables, lists and boards. */
  flush?: boolean;
}) {
  return (
    <div
      data-slot="frame-panel"
      className={cn(
        "relative min-w-0 grow overflow-hidden rounded-[4px] border border-border bg-card shadow-xs",
        !flush && "p-4",
        className,
      )}
      {...props}
    />
  );
}

export function FrameHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <header
      data-slot="frame-header"
      className={cn(
        "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function FrameTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="frame-title"
      className={cn(
        "flex min-w-0 max-w-full items-center gap-2 truncate text-sm font-semibold text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function FrameFooter({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      data-slot="frame-footer"
      className={cn("flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
