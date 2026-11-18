import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STAGGER_ITEM } from "@/lib/interaction";

export type TimelineTone = "default" | "running" | "paused" | "error" | "info";

export interface TimelineItem {
  id: string;
  /** What happened — business wording, e.g. "张明 完成「点检」". */
  title: ReactNode;
  /** Time, actor or scope line under the title. */
  meta?: ReactNode;
  /** Optional detail block (diff, note, attachment). */
  detail?: ReactNode;
  tone?: TimelineTone;
}

const dotTone: Record<TimelineTone, string> = {
  default: "bg-muted-foreground/40",
  running: "bg-[color:var(--state-running-fg)]",
  paused: "bg-[color:var(--state-paused-fg)]",
  error: "bg-[color:var(--state-error-fg)]",
  info: "bg-[color:var(--state-info-fg)]",
};

/**
 * Timeline — ReUI-style vertical event rail for activity feeds and audit
 * trails. Newest first; items rise in sequence on mount. Read-only display.
 */
export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "relative space-y-4 before:absolute before:inset-y-1.5 before:left-[5px] before:w-px before:bg-border",
        className,
      )}
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          style={{ "--i": index } as CSSProperties}
          className={cn("relative pl-6", STAGGER_ITEM)}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-1 size-[11px] rounded-full ring-[3px] ring-card",
              dotTone[item.tone ?? "default"],
            )}
          />
          <div className="text-sm leading-5 text-foreground">{item.title}</div>
          {item.meta ? <div className="caption mt-0.5">{item.meta}</div> : null}
          {item.detail ? <div className="mt-2">{item.detail}</div> : null}
        </li>
      ))}
    </ol>
  );
}
