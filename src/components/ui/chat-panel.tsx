import type { ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSpark } from "@/components/ui/chat-spark";
import { ChatThread } from "@/components/ui/chat-thread";
import { FrameHeader, FrameTitle } from "@/components/ui/frame";
import { cn } from "@/lib/utils";

export function ChatNewButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label="新对话"
      title="新对话"
      onClick={onClick}
    >
      <MessageSquarePlus aria-hidden />
    </Button>
  );
}

export interface ChatPanelProps {
  title: ReactNode;
  actions?: ReactNode;
  /** Page-level context (alarm banner, current record). */
  context?: ReactNode;
  empty?: ReactNode;
  prompts?: ReactNode;
  composer: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  /**
   * Parent already has an edge (dock rail, launcher window).
   * One surface, no second card border.
   */
  flush?: boolean;
  /** Spark mark: writing while the current turn is streaming. */
  busy?: boolean;
  /** Hide the spark next to the title (e.g. when title is a history select). */
  showMark?: boolean;
  /** Session id forwarded to ChatThread so new/history swaps crossfade. */
  threadKey?: string;
}

/**
 * ChatPanel — one card: header, optional banner, thread, composer.
 * Not Frame + FramePanel. Height comes from the parent, never `h-svh`.
 */
export function ChatPanel({
  title,
  actions,
  context,
  empty,
  prompts,
  composer,
  children,
  className,
  headerClassName,
  flush = false,
  busy = false,
  showMark = true,
  threadKey,
}: ChatPanelProps) {
  return (
    <section
      data-slot="chat-panel"
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card",
        !flush && "rounded-[4px] border border-border",
        className,
      )}
    >
      <FrameHeader className={cn(flush && "px-3 pt-3", headerClassName)}>
        {showMark ? (
          <FrameTitle>
            <ChatSpark status={busy ? "writing" : "idle"} size={15} announce={false} />
            {title}
          </FrameTitle>
        ) : (
          <div className="flex min-w-0 flex-1 items-center">{title}</div>
        )}
        {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
      </FrameHeader>
      {context ? <div className="min-w-0 px-3 pb-3">{context}</div> : null}
      <ChatThread empty={empty} threadKey={threadKey}>
        {children}
      </ChatThread>
      {prompts}
      {composer}
    </section>
  );
}
