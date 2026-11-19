"use client";

import type { ReactNode } from "react";
import { Minus, X } from "lucide-react";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { ChatSpark } from "@/components/ui/chat-spark";
import {
  AnimatePresence,
  cornerFabVariants,
  cornerPanelVariants,
  cornerPop,
  fadeOnlyVariants,
  fadeSwap,
  motion,
  useReducedMotion,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

export type ChatLauncherMode = "closed" | "open" | "minimized";

export interface ChatLauncherProps {
  mode: ChatLauncherMode;
  onModeChange: (mode: ChatLauncherMode) => void;
  title?: ReactNode;
  /** @deprecated Unused: closed / minimized both render the avatar FAB. */
  barLabel?: string;
  /** Unread / new-reply mark on the avatar FAB. */
  unread?: boolean;
  /** Header actions before minimize/close, typically ChatNewButton. */
  actions?: ReactNode;
  /** Spark mark: writing while the current turn is streaming. */
  busy?: boolean;
  /** Hide the spark next to the title (e.g. when title is a history select). */
  showMark?: boolean;
  panel: ReactNode;
  className?: string;
}

const ANCHOR = "pointer-events-auto absolute right-4 bottom-4 origin-bottom-right";

function LauncherFab({
  unread,
  onOpen,
}: {
  unread: boolean;
  onOpen: () => void;
}) {
  return (
    <Tooltip title="AI 助手" placement="left" anchorClassName="inline-flex">
      <button
        type="button"
        aria-label="打开 AI 助手"
        onClick={onOpen}
        className={cn(
          "relative size-12 rounded-full",
          "transition-transform duration-[var(--motion-fast)] ease-[var(--motion-spring)]",
          "hover:scale-[1.04] active:scale-[0.97]",
          "outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
        )}
      >
        <ChatAvatar size={48} />
        {unread ? (
          <span
            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
            aria-hidden
          />
        ) : null}
      </button>
    </Tooltip>
  );
}

/**
 * ChatLauncher — corner popup. The window and the FAB are two layers:
 * the panel scales from bottom-right; closed / minimized are the same
 * circular ChatAvatar with an 「AI 助手」 hover tip. No layout-size morph.
 */
export function ChatLauncher({
  mode,
  onModeChange,
  title = "助手",
  unread = false,
  actions,
  busy = false,
  showMark = true,
  panel,
  className,
}: ChatLauncherProps) {
  const reduceMotion = useReducedMotion() === true;
  const panelVariants = reduceMotion ? fadeOnlyVariants : cornerPanelVariants;
  const fabVariants = reduceMotion ? fadeOnlyVariants : cornerFabVariants;
  const popTransition = reduceMotion ? fadeSwap : cornerPop;
  const open = () => onModeChange("open");

  return (
    <div
      data-slot="chat-launcher"
      className={cn("pointer-events-none absolute inset-0 z-20", className)}
    >
      <AnimatePresence initial={false}>
        {mode === "open" ? (
          <motion.div
            key="panel"
            className={cn(
              ANCHOR,
              "z-20 flex h-[min(32rem,calc(100%-2rem))] w-[min(22rem,calc(100%-2rem))] flex-col overflow-hidden rounded-[4px] border border-border bg-card shadow-lg",
            )}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={popTransition}
          >
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-2 pl-3">
              {showMark ? (
                <p className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold">
                  <ChatSpark status={busy ? "writing" : "idle"} size={15} announce={false} />
                  <span className="truncate">{title}</span>
                </p>
              ) : (
                <div className="flex min-w-0 flex-1 items-center">{title}</div>
              )}
              <div className="flex shrink-0 items-center">
                {actions}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="最小化"
                  onClick={() => onModeChange("minimized")}
                >
                  <Minus aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="结束对话"
                  onClick={() => onModeChange("closed")}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {mode !== "open" ? (
          <motion.div
            key="fab"
            className={cn(ANCHOR, "z-10")}
            variants={fabVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={popTransition}
          >
            <LauncherFab unread={unread} onOpen={open} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
