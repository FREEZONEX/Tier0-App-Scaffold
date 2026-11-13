"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ViewListDrawer — 视图列表: 「＋ 创建视图」「已创建 N 条，
 * 最多创建 20 条」, table 视图名称 (drag handle + icon) / 操作 (编辑 复制 删除).
 * Dragging a row saves the new order (PUT sortOrder).
 */
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { Drawer } from "@/components/overlays/drawer";
import { Button } from "@/components/ui/button";
import { TextButton } from "@/components/kit/ui/buttons";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { errorMessage } from "@/lib/component-kit/api-client";
import { useRequest } from "@/lib/hooks";
import type { ViewDef } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { ViewIcon } from "@/components/kit/meta/view-icon";
import { DragHandle, dragInsertionClass } from "@/components/kit/ui/drag-handle";

const VIEW_LIMIT = 20;

export interface ViewListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectCode: string;
  activeCode?: string;
  onCreate: () => void;
  onEdit: (viewCode: string) => void;
  onCopy: (viewCode: string) => void;
  onDelete: (view: Pick<ViewDef, "code" | "name">) => void;
  /** Views were reordered (reload the page config). */
  onChanged: () => void;
  /** Change to refetch (e.g. the config's view codes). */
  refreshKey?: string;
}

export function ViewListContent({
  objectCode,
  activeCode,
  refreshKey,
  onCreate,
  onEdit,
  onCopy,
  onDelete,
  onChanged,
}: Omit<ViewListDrawerProps, "open" | "onOpenChange">) {
  const api = useKitApi();
  const [token, setToken] = useState(0);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; edge: "before" | "after" } | null>(null);
  const views = useRequest(`meta-views:${objectCode}:${refreshKey ?? ""}:${token}`, (signal) =>
    api.getJson<ViewDef[]>(apiUrl(`/api/meta/views/${objectCode}`), { signal }),
  );

  const ordered = useMemo(() => {
    const list = [...(views.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (!order) return list;
    const byCode = new Map(list.map((view) => [view.code, view]));
    const result = order.map((code) => byCode.get(code)).filter((view): view is ViewDef => Boolean(view));
    for (const view of list) if (!order.includes(view.code)) result.push(view);
    return result;
  }, [order, views.data]);

  const saveOrder = async (next: ViewDef[]) => {
    setOrder(next.map((view) => view.code));
    try {
      await Promise.all(
        next.map((view, index) =>
          view.sortOrder === index + 1
            ? Promise.resolve()
            : api.sendJson(apiUrl(`/api/meta/views/${objectCode}/${view.code}`), { method: "PUT", body: { sortOrder: index + 1 } }),
        ),
      );
      setToken((value) => value + 1);
      setOrder(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "保存视图顺序失败"));
      setOrder(null);
    }
  };

  const columns: DataGridColumn<ViewDef>[] = [
    {
      key: "name",
      title: "视图名称",
      width: 280,
      ellipsis: false,
      render: (view) => (
        <span className="flex min-w-0 items-center gap-2">
          <DragHandle />
          <ViewIcon icon={view.icon} />
          <span className={cn("truncate", view.code === activeCode && "font-medium text-foreground")} title={view.name}>
            {view.name}
          </span>
          {view.builtIn ? <span className="shrink-0 text-xs text-text-tertiary">内置</span> : null}
        </span>
      ),
    },
    {
      key: "__actions",
      title: "操作",
      width: 168,
      ellipsis: false,
      render: (view) => (
        <span className="flex items-center gap-3">
          <TextButton onClick={() => onEdit(view.code)}>编辑</TextButton>
          <TextButton onClick={() => onCopy(view.code)} disabled={(views.data?.length ?? 0) >= VIEW_LIMIT}>
            复制
          </TextButton>
          {!view.builtIn ? (
            <TextButton tone="danger" onClick={() => onDelete(view)}>
              删除
            </TextButton>
          ) : null}
        </span>
      ),
    },
  ];

  const count = views.data?.length ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" icon={<Plus />} disabled={count >= VIEW_LIMIT} onClick={onCreate}>
          创建视图
        </Button>
        <span className="text-sm text-text-tertiary">
          已创建 {count} 条，最多创建 {VIEW_LIMIT} 条
        </span>
      </div>
      <AsyncView result={views} isEmpty={() => false}>
        {() => (
          <DataGrid<ViewDef>
            aria-label="视图列表"
            showIndex={false}
            columns={columns}
            rows={ordered}
            rowKey={(view) => view.code}
            rowHeight="MID"
            rowProps={(_view, index) => ({
              draggable: true,
              onDragStart: (event) => {
                setDragIndex(index);
                setDropTarget(null);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              },
              onDragOver: (event) => {
                if (dragIndex === null) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                setDropTarget((current) => current?.index === index && current.edge === edge ? current : { index, edge });
              },
              onDrop: (event) => {
                event.preventDefault();
                if (dragIndex !== null && dropTarget) {
                  const next = [...ordered];
                  const [moved] = next.splice(dragIndex, 1);
                  let insertAt = dropTarget.index + (dropTarget.edge === "after" ? 1 : 0);
                  if (dragIndex < insertAt) insertAt -= 1;
                  next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, moved);
                  if (next.some((view, nextIndex) => view.code !== ordered[nextIndex]?.code)) void saveOrder(next);
                }
                setDragIndex(null);
                setDropTarget(null);
              },
              onDragEnd: () => {
                setDragIndex(null);
                setDropTarget(null);
              },
              className: cn(
                dragIndex === index && "opacity-40",
                dropTarget?.index === index && dragInsertionClass(dropTarget.edge, true),
              ),
            })}
          />
        )}
      </AsyncView>
    </div>
  );
}

export function ViewListDrawer({ open, onOpenChange, ...rest }: ViewListDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="视图列表" size="lg">
      {open ? <ViewListContent {...rest} /> : null}
    </Drawer>
  );
}
