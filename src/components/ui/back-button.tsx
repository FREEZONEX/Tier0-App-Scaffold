import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where「返回」goes: the parent level of the current page (list of a detail
 * page, queue of a task page…). Always an explicit route, never
 * `history.back()`, so a page opened from a link or after a refresh still
 * leads to its parent.
 */
export interface BackTarget {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  /** Name of the parent level, e.g. 生产批次; announced as「返回{label}」. */
  label: string;
}

export interface BackButtonProps extends BackTarget {
  /** Show「← label」 instead of the icon-only square (task-first station pages). */
  showLabel?: boolean;
  className?: string;
}

/** BackButton — the one way back to the parent level, left of the page title. */
export function BackButton({ to, params, search, label, showLabel = false, className }: BackButtonProps) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      aria-label={`返回${label}`}
      title={`返回${label}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-4",
        showLabel ? "h-9 px-3 text-sm font-medium" : "size-8",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" />
      {showLabel ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}
