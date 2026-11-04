"use client";

/**
 * ViewTabs — 视图页签:
 * [彩色文档图标 视图名 ⋮] × N + ＋. ⋮ = 编辑 / 复制 / 删除 (内置「全部」不可删);
 * ＋ opens the 视图列表 drawer.
 */
import { Copy, EllipsisVertical, PenLine, Plus, Trash2 } from "lucide-react";
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
  className,
}: ViewTabsProps) {
  const active = activeCode ?? views[0]?.code;
  return (
    <div
      className={cn(
        "flex h-11 min-w-0 items-stretch border-b border-border-secondary",
        className,
      )}
    >
      <div
        className="scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden"
        role="tablist"
        aria-label="视图"
      >
        {views.map((view, index) => {
          const selected = view.code === active;
          return (
            <div
              key={view.code}
              className={cn(
                "relative flex h-11 shrink-0 items-center",
                index > 0 &&
                  "before:absolute before:top-1/2 before:left-0 before:h-3.5 before:w-px before:-translate-y-1/2 before:bg-border-secondary before:content-['']",
              )}
            >
              <div
                className={cn(
                  "flex h-8 items-center gap-0.5 px-3",
                  index === 0 && "pl-1",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={view.name}
                  className={cn(
                    "inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-[4px] px-1 text-sm leading-none",
                    "transition-colors duration-150 ease-out motion-reduce:transition-none",
                    selected
                      ? "font-medium text-foreground"
                      : "font-normal text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onSwitch(view.code)}
                >
                  <ViewIcon icon={view.icon} size={16} className="block size-4" />
                  <span className="truncate leading-none">{view.name}</span>
                </button>
                {manageable ? (
                  <DropdownMenu
                    placement="bottom-start"
                    minWidth={112}
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
                    <IconButton
                      size="sm"
                      label="视图操作"
                      tooltip={false}
                      icon={<EllipsisVertical className="block size-3.5" strokeWidth={2.25} />}
                      className={cn(
                        "size-8 shrink-0 [&_svg]:size-3.5",
                        selected ? "text-foreground" : "text-text-tertiary",
                      )}
                    />
                  </DropdownMenu>
                ) : null}
              </div>
              {selected ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--tier0-highlight-deep)]"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {manageable ? (
        <div className="flex h-11 shrink-0 items-center border-l border-border-secondary pl-3">
          <IconButton label="视图列表" icon={<Plus />} onClick={onOpenList} />
        </div>
      ) : null}
    </div>
  );
}
