"use client";

import type { ReactNode } from "react";
import { Minus, X } from "lucide-react";
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
  /** Minimized bar copy when `title` is not a string. */
  barLabel?: string;
  /** Unread / new-reply mark on the minimized bar and launcher. */
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
    <button
      type="button"
      aria-label="打开助手"
      title="打开助手"
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
  );
}

function LauncherChip({
  label,
  unread,
  onOpen,
}: {
  label: string;
  unread: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`展开对话：${label}`}
      title={`展开对话：${label}`}
      onClick={onOpen}
      className={cn(
        "flex h-12 w-max max-w-full items-center gap-2 rounded-[4px] border border-border bg-card py-1 pr-3.5 pl-1.5 text-left",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
        "hover:bg-muted",
        "outline-none focus-visible:bg-muted",
      )}
    >
      <ChatAvatar size={36} />
      <span className="min-w-0 truncate text-sm font-medium">{label}</span>
      {unread ? (
        <span className="shrink-0 rounded-[4px] bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          新回复
        </span>
      ) : null}
    </button>
  );
}

/**
 * ChatLauncher — corner popup. The window and the FAB are two layers:
 * the panel scales from bottom-right; the circular ChatAvatar (or the
 * minimized chip) crossfades in the same corner. No layout-size morph.
 */
export function ChatLauncher({
  mode,
  onModeChange,
  title = "助手",
  barLabel,
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
  const chipLabel = barLabel ?? (typeof title === "string" ? title : "助手");
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
            key={mode}
            className={cn(ANCHOR, "z-10 max-w-[calc(100%-2rem)]")}
            variants={fabVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={popTransition}
          >
            {mode === "minimized" ? (
              <LauncherChip label={chipLabel} unread={unread} onOpen={open} />
            ) : (
              <LauncherFab unread={unread} onOpen={open} />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
