import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/kit/ui/avatar";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { StreamText } from "@/components/ui/stream-text";
import { cn } from "@/lib/utils";

export type ChatRole = "user" | "assistant";

export interface ChatCitation {
  id: string;
  label: string;
  onOpen?: () => void;
}

export interface ChatMessageProps {
  role: ChatRole;
  /** Display name for the avatar (sr-only in the transcript). */
  name?: string;
  /** Plain or markdown-lite body. Prefer this over `children` while streaming. */
  text?: string;
  streaming?: boolean;
  citations?: ChatCitation[];
  /** Extra actions under the body (copy, apply). Outline buttons only. */
  actions?: ReactNode;
  /** Retrieval ticks, folded reasoning, code artifacts — beside the prose. */
  extra?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const citationClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-[4px] border border-border bg-card py-0 pl-2 text-xs leading-5 text-muted-foreground";
const citationInteractiveClass =
  "pr-1.5 transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:bg-muted focus-visible:text-foreground";
const citationStaticClass = "pr-2";

/**
 * ChatMessage — one turn. Adapted from shadcnuikit Bubble/Message:
 * 4px corners, user on a muted fill (not highlight lime), assistant as
 * unfilled transcript. Citations sit under 「来源」; openable chips get
 * ArrowUpRight, not a bare tag.
 */
export function ChatMessage({
  role,
  name,
  text,
  streaming = false,
  citations,
  actions,
  extra,
  children,
  className,
}: ChatMessageProps) {
  const user = role === "user";
  const label = name ?? (user ? "我" : "助手");

  return (
    <article
      data-slot="chat-message"
      data-role={role}
      className={cn(
        "flex w-full min-w-0 items-start gap-2.5",
        user ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {user ? (
        <Avatar name={label} size="sm" />
      ) : (
        <ChatAvatar />
      )}
      <div
        className={cn(
          "flex min-w-0 max-w-[min(100%,40rem)] flex-col",
          user ? "items-end" : "items-start gap-2",
        )}
      >
        <p className="sr-only">{label}</p>
        {user ? (
          <div
            data-slot="chat-bubble"
            className="rounded-[4px] bg-muted px-3.5 py-2 text-sm leading-6 text-foreground shadow-xs"
          >
            {text ?? children}
          </div>
        ) : (
          <div data-slot="chat-assistant" className="min-w-0 w-full">
            {text != null ? (
              <StreamText text={text} streaming={streaming && text.length > 0} />
            ) : (
              children
            )}
            {extra ? <div className="mt-2 flex flex-col gap-2">{extra}</div> : null}
            {citations && citations.length > 0 && !streaming ? (
              <div className="mt-2 flex min-w-0 flex-col gap-1">
                <p className="text-xs leading-4 text-muted-foreground">来源</p>
                <ul className="flex flex-wrap gap-1.5">
                  {citations.map((cite) => (
                    <li key={cite.id} className="min-w-0">
                      {cite.onOpen ? (
                        <button
                          type="button"
                          className={cn(citationClass, citationInteractiveClass)}
                          aria-label={`打开来源 ${cite.label}`}
                          title={`打开 ${cite.label}`}
                          onClick={cite.onOpen}
                        >
                          <span className="min-w-0 truncate">{cite.label}</span>
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden />
                        </button>
                      ) : (
                        <span className={cn(citationClass, citationStaticClass)}>
                          <span className="min-w-0 truncate">{cite.label}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {actions && !streaming ? (
              <div className="mt-2 flex flex-wrap gap-1.5">{actions}</div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
