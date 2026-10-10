"use client";

/**
 * ViewTabs — 视图页签 (200_work_order_list.png, 232_wo_view_more_all.png):
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
        "flex min-w-0 items-stretch border-b border-border-secondary",
        className,
      )}
    >
      <div
        className="scrollbar-none -mb-px flex min-w-0 flex-1 items-stretch overflow-x-auto"
        role="tablist"
        aria-label="视图"
      >
        {views.map((view, index) => {
          const selected = view.code === active;
          return (
            <div
              key={view.code}
              className={cn(
                "relative flex shrink-0 items-center gap-0.5 pr-1",
                index > 0 &&
                  "before:mr-3 before:h-4 before:w-px before:bg-border-secondary before:content-['']",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                title={view.name}
                className={cn(
                  "flex h-11 max-w-[12rem] items-center gap-1.5 border-b-2 px-1 text-sm transition-colors duration-150",
                  selected
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-foreground hover:text-brand-hover",
                )}
                onClick={() => onSwitch(view.code)}
              >
                <ViewIcon icon={view.icon} />
                <span className="truncate">{view.name}</span>
              </button>
              {manageable ? (
                <DropdownMenu
                  placement="bottom-start"
                  minWidth={112}
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
                    icon={<EllipsisVertical />}
                    className={cn(
                      selected ? "text-brand" : "text-text-tertiary",
                    )}
                  />
                </DropdownMenu>
              ) : null}
            </div>
          );
        })}
      </div>
      {manageable ? (
        <div className="flex shrink-0 items-center pl-3">
          <IconButton label="视图列表" icon={<Plus />} onClick={onOpenList} />
        </div>
      ) : null}
    </div>
  );
}
