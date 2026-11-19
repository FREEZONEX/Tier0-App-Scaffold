"use client";

import { useState } from "react";
import { ChevronDown, Ellipsis, History, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import { Popover } from "@/components/kit/ui/popover";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface ChatHistoryItem {
  id: string;
  title: string;
  preview?: string;
  /** Already formatted, e.g. "今天 08:12". */
  updatedAt: string;
}

export interface ChatHistoryListProps {
  items: ChatHistoryItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

function ChatHistoryRow({
  item,
  active,
  onSelect,
  onDelete,
}: {
  item: ChatHistoryItem;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li className="group/hist relative min-w-0">
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        className={cn(
          "w-full min-w-0 rounded-[4px] py-1.5 pl-2 text-left",
          onDelete ? "pr-8" : "pr-2",
          "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
          active && "bg-muted",
        )}
        onClick={() => onSelect(item.id)}
      >
        <span className="block truncate text-sm leading-5">{item.title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs leading-4 text-muted-foreground">
          <span className="shrink-0 tabular-nums">{item.updatedAt}</span>
          {item.preview ? <span className="min-w-0 truncate">{item.preview}</span> : null}
        </span>
      </button>
      {onDelete ? (
        <div
          className={cn(
            "absolute top-1 right-1 z-10",
            "opacity-0 group-hover/hist:opacity-100 group-focus-within/hist:opacity-100 pointer-coarse:opacity-100",
            menuOpen && "opacity-100",
          )}
        >
          <DropdownMenu
            trigger="click"
            placement="bottom-end"
            minWidth={112}
            aria-label={`${item.title} 的操作`}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            items={[
              {
                key: "delete",
                label: "删除",
                danger: true,
                icon: <Trash2 />,
                onClick: () => onDelete(item.id),
              },
            ]}
          >
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`${item.title} 的更多操作`}
            >
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenu>
        </div>
      ) : null}
    </li>
  );
}

/**
 * ChatHistoryList — past threads. Select loads a session. Delete lives in a
 * hover-revealed ⋯ menu, then the parent confirms. Not a recents chip list.
 */
export function ChatHistoryList({
  items,
  activeId,
  onSelect,
  onDelete,
  className,
}: ChatHistoryListProps) {
  if (!items.length) {
    return (
      <EmptyState
        size="sm"
        title="还没有历史对话"
        description="问完一轮后点「新对话」，上一轮会出现在这里。"
      />
    );
  }

  return (
    <ul
      data-slot="chat-history-list"
      tabIndex={0}
      aria-label="历史对话列表"
      className={cn("flex flex-col gap-0.5 outline-none", className)}
    >
      {items.map((item) => (
        <ChatHistoryRow
          key={item.id}
          item={item}
          active={item.id === activeId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

export interface ChatHistorySelectProps {
  items: ChatHistoryItem[];
  activeId?: string | null;
  /** Shown on the trigger; typically the current thread title. */
  currentTitle?: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/**
 * ChatHistorySelect — header dropdown of past threads. Replaces a static
 * assistant name in the title slot.
 */
export function ChatHistorySelect({
  items,
  activeId,
  currentTitle = "新对话",
  onSelect,
  onDelete,
  className,
}: ChatHistorySelectProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ChatHistoryItem | null>(null);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        aria-label="历史对话"
        className="w-72 p-2"
        anchorClassName="flex min-w-0 max-w-full"
        content={({ close }) => (
          <ChatHistoryList
            items={items}
            activeId={activeId}
            onSelect={(id) => {
              onSelect(id);
              close();
            }}
            onDelete={
              onDelete
                ? (id) => {
                    const item = items.find((row) => row.id === id);
                    if (!item) return;
                    close();
                    setPending(item);
                  }
                : undefined
            }
          />
        )}
      >
        <button
          type="button"
          aria-label={`历史对话，当前：${currentTitle}`}
          className={cn(
            "inline-flex h-7 max-w-full min-w-0 items-center gap-0.5 rounded-[4px] px-1.5 text-left text-sm font-semibold leading-5",
            "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
            className,
          )}
        >
          <span className="min-w-0 truncate">{currentTitle}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </Popover>
      {onDelete ? (
        <ConfirmDialog
          open={pending != null}
          onOpenChange={(next) => {
            if (!next) setPending(null);
          }}
          title="删除这条对话？"
          description={
            pending
              ? `删除后无法从本列表恢复。「${pending.title}」及其回复都会去掉。`
              : ""
          }
          confirmLabel="删除"
          destructive
          onConfirm={() => {
            if (pending) onDelete(pending.id);
            setPending(null);
          }}
        />
      ) : null}
    </>
  );
}

export interface ChatHistoryButtonProps {
  items: ChatHistoryItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/**
 * ChatHistoryButton — header ghost control that opens the session list.
 */
export function ChatHistoryButton({
  items,
  activeId,
  onSelect,
  onDelete,
  className,
}: ChatHistoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ChatHistoryItem | null>(null);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        title="历史对话"
        placement="bottom-end"
        aria-label="历史对话"
        className="w-72 p-2"
        content={({ close }) => (
          <ChatHistoryList
            items={items}
            activeId={activeId}
            onSelect={(id) => {
              onSelect(id);
              close();
            }}
            onDelete={
              onDelete
                ? (id) => {
                    const item = items.find((row) => row.id === id);
                    if (!item) return;
                    close();
                    setPending(item);
                  }
                : undefined
            }
          />
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground hover:text-foreground", className)}
          aria-label="历史对话"
          title="历史对话"
        >
          <History aria-hidden />
        </Button>
      </Popover>
      {onDelete ? (
        <ConfirmDialog
          open={pending != null}
          onOpenChange={(next) => {
            if (!next) setPending(null);
          }}
          title="删除这条对话？"
          description={
            pending
              ? `删除后无法从本列表恢复。「${pending.title}」及其回复都会去掉。`
              : ""
          }
          confirmLabel="删除"
          destructive
          onConfirm={() => {
            if (pending) onDelete(pending.id);
            setPending(null);
          }}
        />
      ) : null}
    </>
  );
}
