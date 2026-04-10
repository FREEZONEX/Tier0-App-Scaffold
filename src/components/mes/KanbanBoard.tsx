"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * KanbanBoard — multi-column drag-and-drop board.
 *
 * Usage:
 *   <KanbanBoard
 *     columns={[
 *       { id: "pending", title: "Pending", items: [...] },
 *       { id: "in_progress", title: "In Progress", items: [...] },
 *       { id: "done", title: "Done", items: [...] },
 *     ]}
 *     onMove={(itemId, fromCol, toCol) => { ... }}
 *     renderCard={(item) => <div>{item.title}</div>}
 *   />
 */

export interface KanbanItem {
  id: string;
  [key: string]: unknown;
}

export interface KanbanColumn<T extends KanbanItem = KanbanItem> {
  id: string;
  title: string;
  items: T[];
  /** Optional accent color for column header */
  color?: string;
}

interface KanbanBoardProps<T extends KanbanItem = KanbanItem> {
  columns: KanbanColumn<T>[];
  /** Called when a card is dropped into a different column. */
  onMove?: (itemId: string, fromColumnId: string, toColumnId: string) => void;
  /** Render function for each card. */
  renderCard: (item: T) => ReactNode;
  className?: string;
}

function SortableCard<T extends KanbanItem>({
  item,
  renderCard,
}: {
  item: T;
  renderCard: (item: T) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "cursor-grab rounded-lg border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] active:cursor-grabbing",
        isDragging && "scale-[1.02] rotate-[1deg] shadow-[var(--shadow-lg)] opacity-90"
      )}
      {...attributes}
      {...listeners}
    >
      {renderCard(item)}
    </div>
  );
}

export function KanbanBoard<T extends KanbanItem = KanbanItem>({
  columns,
  onMove,
  renderCard,
  className,
}: KanbanBoardProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const findColumn = useCallback(
    (itemId: string) => columns.find((col) => col.items.some((it) => it.id === itemId)),
    [columns]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !onMove) return;

      const fromCol = findColumn(active.id as string);
      // over could be a column id or another item id
      const toCol = columns.find((c) => c.id === over.id) ?? findColumn(over.id as string);

      if (fromCol && toCol && fromCol.id !== toCol.id) {
        onMove(active.id as string, fromCol.id, toCol.id);
      }
    },
    [columns, findColumn, onMove]
  );

  const allIds = columns.flatMap((c) => c.items.map((i) => i.id));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={cn("flex gap-4 overflow-x-auto pb-2", className)}>
        {columns.map((col) => (
          <div key={col.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-gray-50/80 border border-[var(--border)]">
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
              {col.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />}
              <span className="text-xs font-semibold">{col.title}</span>
              <span className="ml-auto rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                {col.items.length}
              </span>
            </div>

            {/* Cards */}
            <SortableContext items={col.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-1 flex-col gap-2 p-2" style={{ minHeight: 80 }}>
                {col.items.map((item) => (
                  <SortableCard key={item.id} item={item} renderCard={renderCard} />
                ))}
                {col.items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 text-[10px] text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
