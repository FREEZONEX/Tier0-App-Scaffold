"use client";

/**
 * ViewTabs — 视图页签: [彩色文档图标 视图名 ⋮] × N + ＋.
 * ⋮ = 编辑 / 复制 / 删除 (内置「全部」不可删); ＋ opens the 视图列表 drawer.
 *
 * Accessibility (WAI-ARIA tabs, manual activation):
 * - the tablist contains only tabs; ←/→/Home/End move focus, Enter/Space switches
 *   the view (switching loads a new config, so focus alone never triggers it);
 * - only the selected tab is in the Tab order;
 * - the per-tab ⋮ is a pointer shortcut hidden from assistive tech; keyboard users
 *   open the same menu with Shift+F10 or the context-menu key on a tab, and every
 *   action is also in the 视图列表 drawer behind ＋.
 *
 * Visual language matches `Tabs` line style: muted text, selected view in
 * foreground medium weight with a 2px foreground underline; no fill.
 */
import { Copy, EllipsisVertical, PenLine, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/kit/ui/buttons";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import type { ViewDef } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { ViewIcon } from "@/components/kit/meta/view-icon";

type ViewSummary = Pick<ViewDef, "code" | "name" | "icon" | "builtIn">;

export interface ViewTabsProps {
  views: readonly ViewSummary[];
  activeCode: string | undefined;
  onSwitch: (viewCode: string) => void;
  onEdit: (viewCode: string) => void;
  onCopy: (viewCode: string) => void;
  onDelete: (view: ViewSummary) => void;
  onOpenList: () => void;
  /** Show the ⋮ menus and ＋ (视图管理权限). Default true. */
  manageable?: boolean;
  /** The selected view's data is still loading (shows a busy state on that tab). */
  pending?: boolean;
  className?: string;
}

export function ViewTabs({
  views,
  activeCode,
  onSwitch,
  onEdit,
  onCopy,
  onDelete,
  onOpenList,
  manageable = true,
  pending = false,
  className,
}: ViewTabsProps) {
  const active = activeCode ?? views[0]?.code;
  const hintId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [keyboardMenu, setKeyboardMenu] = useState(false);

  const focusTab = (code: string) => tabRefs.current.get(code)?.focus();

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, view: ViewSummary) {
    const last = views.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
        : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
          : event.key === "Home" ? 0
            : event.key === "End" ? last
              : null;
    if (target !== null) {
      event.preventDefault();
      focusTab(views[target].code);
      tabRefs.current.get(views[target].code)?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    if (manageable && (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) {
      event.preventDefault();
      setKeyboardMenu(true);
      setMenuFor(view.code);
    }
  }

  return (
    <div
      className={cn(
        "flex h-11 min-w-0 items-stretch border-b border-border-secondary",
        className,
      )}
    >
      {manageable ? (
        <span id={hintId} hidden>
          按 Shift+F10 打开视图操作
        </span>
      ) : null}
      <div className="scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden">
        <div className="flex w-max items-stretch gap-1" role="tablist" aria-label="视图">
          {views.map((view, index) => {
            const selected = view.code === active;
            return (
              <div
                key={view.code}
                role="presentation"
                className="group/view relative flex h-11 shrink-0 items-center"
              >
                <button
                  type="button"
                  ref={(element) => {
                    if (element) tabRefs.current.set(view.code, element);
                    else tabRefs.current.delete(view.code);
                  }}
                  role="tab"
                  aria-selected={selected}
                  aria-busy={selected && pending ? true : undefined}
                  aria-describedby={manageable ? hintId : undefined}
                  aria-keyshortcuts={manageable ? "Shift+F10" : undefined}
                  tabIndex={selected ? 0 : -1}
                  title={view.name}
                  className={cn(
                    "inline-flex h-8 max-w-[12rem] items-center gap-2 rounded-[4px] px-2 text-sm leading-none outline-none pointer-coarse:h-11 focus-visible:ring-2 focus-visible:ring-ring/50",
                    "transition-colors duration-150 ease-out motion-reduce:transition-none",
                    index === 0 && "pl-1",
                    selected
                      ? "font-medium text-foreground"
                      : "font-normal text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onSwitch(view.code)}
                  onKeyDown={(event) => onTabKeyDown(event, index, view)}
                >
                  <ViewIcon icon={view.icon} size={16} className="block size-4" />
                  <span className="truncate leading-none">{view.name}</span>
                  {selected && pending ? (
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                    />
                  ) : null}
                </button>
                {manageable ? (
                  <DropdownMenu
                    placement="bottom-start"
                    minWidth={112}
                    open={menuFor === view.code}
                    onOpenChange={(open) => {
                      setMenuFor(open ? view.code : null);
                      if (!open) setKeyboardMenu(false);
                    }}
                    focusFirstOnOpen={keyboardMenu}
                    returnFocus={() => focusTab(view.code)}
                    anchorClassName="inline-flex h-8 items-center self-center"
                    aria-label={`视图「${view.name}」操作`}
                    items={[
                      {
                        key: "edit",
                        label: "编辑",
                        icon: <PenLine />,
                        onClick: () => onEdit(view.code),
                      },
                      {
                        key: "copy",
                        label: "复制",
                        icon: <Copy />,
                        onClick: () => onCopy(view.code),
                      },
                      {
                        key: "delete",
                        label: "删除",
                        icon: <Trash2 />,
                        danger: !view.builtIn,
                        disabled: view.builtIn,
                        title: view.builtIn ? "内置视图不可删除" : undefined,
                        onClick: () => onDelete(view),
                      },
                    ]}
                  >
                    {/* Pointer shortcut only: hidden from the tablist's accessibility tree. */}
                    <IconButton
                      size="sm"
                      label={`视图「${view.name}」操作`}
                      tooltip={false}
                      tabIndex={-1}
                      aria-hidden="true"
                      icon={<EllipsisVertical className="block size-3.5" strokeWidth={2.25} />}
                      className={cn(
                        "size-8 shrink-0 [&_svg]:size-3.5",
                        selected || menuFor === view.code
                          ? "text-foreground"
                          : "text-text-tertiary opacity-70 group-hover/view:opacity-100",
                      )}
                    />
                  </DropdownMenu>
                ) : null}
                {selected ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-foreground"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {manageable ? (
        <div className="flex h-11 shrink-0 items-center border-l border-border-secondary pl-3">
          <IconButton label="视图列表" icon={<Plus />} onClick={onOpenList} />
        </div>
      ) : null}
    </div>
  );
}
