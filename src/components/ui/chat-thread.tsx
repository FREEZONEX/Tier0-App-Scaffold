"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { ArrowDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AnimatePresence,
  fadeSwap,
  motion,
  useReducedMotion,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

const NEAR_BOTTOM_PX = 48;

export interface ChatThreadProps {
  children?: ReactNode;
  empty?: ReactNode;
  jumpLabel?: string;
  className?: string;
  /**
   * Stable id for the current session. Changing it crossfades empty ↔
   * history ↔ new chat instead of swapping the log in place.
   */
  threadKey?: string;
}

/**
 * ChatThread — scrolling log for ChatMessage children.
 * Local autoscroll (no use-stick-to-bottom): stays pinned while the reader
 * is near the bottom; otherwise an outline "回到最新" control appears.
 */
export function ChatThread({
  children,
  empty,
  jumpLabel = "回到最新",
  className,
  threadKey,
}: ChatThreadProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [stuck, setStuck] = useState(true);
  const hasMessages = Children.count(children) > 0;
  const sessionKey = threadKey ?? (hasMessages ? "messages" : "empty");
  const reduceMotion = useReducedMotion() === true;
  const swap = reduceMotion ? { duration: 0 } : fadeSwap;
  const offset = reduceMotion ? 0 : 4;

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const near =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = near;
    setStuck(near);
  };

  const jumpToLatest = () => {
    const el = scrollerRef.current;
    if (!el) return;
    stickRef.current = true;
    setStuck(true);
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    stickRef.current = true;
    setStuck(true);
  }, [sessionKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [children, sessionKey]);

  return (
    <div
      data-slot="chat-thread"
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={sessionKey}
          className="absolute inset-0 flex flex-col"
          initial={{ opacity: 0, y: offset }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -offset }}
          transition={swap}
        >
          <div
            ref={scrollerRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            onScroll={onScroll}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5",
              !hasMessages && "flex items-center justify-center",
            )}
          >
            {hasMessages ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">{children}</div>
            ) : (
              (empty ?? (
                <EmptyState
                  size="sm"
                  icon={<MessageSquare />}
                  title="还没有提问"
                  description="从下方输入，或点一条快捷问题。"
                />
              ))
            )}
          </div>
          {!stuck && hasMessages ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="pointer-events-auto bg-card"
                aria-label={jumpLabel}
                title={jumpLabel}
                onClick={jumpToLatest}
              >
                <ArrowDown aria-hidden />
              </Button>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
