"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable, StateBadge, KanbanBoard, type KanbanItem } from "@/components/mes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/utils";
import { useMe, useCan, readError } from "@/lib/mes-client";
import { format } from "date-fns";

type WoStatus =
  | "PLANNED"
  | "RELEASED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type WorkOrder = {
  id: string;
  number: string;
  itemId: string;
  workCenterId: string | null;
  qtyTarget: number;
  qtyCompleted: number;
  status: WoStatus;
  priority: number;
  dueAt: string | null;
  notes: string | null;
};

type WoRow = {
  workOrder: WorkOrder;
  itemSku: string | null;
  itemName: string | null;
  workCenterCode: string | null;
  workCenterName: string | null;
};

type Item = { id: string; sku: string; name: string };
type WorkCenter = { id: string; code: string; name: string };

interface KanbanWo extends KanbanItem {
  number: string;
  sku: string;
  qty: string;
}

const emptyForm = {
  number: "",
  itemId: "",
  workCenterId: "" as string,
  qtyTarget: "100",
  priority: "50",
  status: "PLANNED" as WoStatus,
  dueAt: "",
  notes: "",
};

function columnForStatus(s: WoStatus): string {
  if (s === "PLANNED") return "planned";
  if (s === "RELEASED") return "released";
  if (s === "IN_PROGRESS" || s === "ON_HOLD") return "active";
  return "closed";
}

function statusFromColumn(col: string): WoStatus | null {
  if (col === "planned") return "PLANNED";
  if (col === "released") return "RELEASED";
  if (col === "active") return "IN_PROGRESS";
  if (col === "closed") return "COMPLETED";
  return null;
}

export default function WorkOrdersPage() {
  const me = useMe();
  const canWrite = useCan(me?.role, "work_orders:write");

  const [items, setItems] = useState<Item[]>([]);
  const [centers, setCenters] = useState<WorkCenter[]>([]);
  const [rows, setRows] = useState<WoRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const [r1, r2, r3] = await Promise.all([
      fetch(apiUrl("/api/items")),
      fetch(apiUrl("/api/work-centers")),
      fetch(apiUrl("/api/work-orders")),
    ]);
    if (!r1.ok || !r2.ok || !r3.ok) {
      const bad = !r1.ok ? r1 : !r2.ok ? r2 : r3;
      setLoadError(await readError(bad));
      return;
    }
    setItems(await r1.json());
    setCenters(await r2.json());
    setRows(await r3.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm({
      ...emptyForm,
      itemId: items[0]?.id ?? "",
      workCenterId: "",
    });
    setDialogOpen(true);
  }

  async function saveNew() {
    setSaving(true);
    try {
      const payload = {
        number: form.number,
        itemId: form.itemId,
        workCenterId: form.workCenterId || null,
        qtyTarget: Number(form.qtyTarget),
        priority: Number(form.priority),
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch(apiUrl("/api/work-orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res));
      toast.success("Work order created");
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const patchStatus = useCallback(
    async (woId: string, status: WoStatus) => {
      const res = await fetch(
        apiUrl(`/api/work-orders?id=${encodeURIComponent(woId)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        toast.error(await readError(res));
        await load();
        return;
      }
      toast.success("Status updated");
      await load();
    },
    [load],
  );

  const onKanbanMove = useCallback(
    async (itemId: string, _from: string, toColumnId: string) => {
      const next = statusFromColumn(toColumnId);
      if (!next) return;
      const row = rows.find((r) => r.workOrder.id === itemId);
      if (!row) return;
      if (row.workOrder.status === next) return;
      if (toColumnId === "closed" && row.workOrder.status === "CANCELLED") {
        return;
      }
      if (toColumnId === "closed") {
        if (
          row.workOrder.status === "COMPLETED" ||
          row.workOrder.status === "CANCELLED"
        ) {
          return;
        }
        await patchStatus(itemId, "COMPLETED");
        return;
      }
      await patchStatus(itemId, next);
    },
    [rows, patchStatus],
  );

  const kanbanColumns = useMemo(() => {
    const map: Record<string, KanbanWo[]> = {
      planned: [],
      released: [],
      active: [],
      closed: [],
    };
    for (const r of rows) {
      const id = columnForStatus(r.workOrder.status);
      map[id].push({
        id: r.workOrder.id,
        number: r.workOrder.number,
        sku: r.itemSku ?? "—",
        qty: `${r.workOrder.qtyCompleted}/${r.workOrder.qtyTarget}`,
      });
    }
    return [
      { id: "planned", title: "Planned", items: map.planned },
      { id: "released", title: "Released", items: map.released },
      { id: "active", title: "WIP", items: map.active, color: "var(--accent)" },
      { id: "closed", title: "Closed", items: map.closed },
    ];
  }, [rows]);

  const columns: ColumnDef<WoRow>[] = [
    {
      accessorKey: "workOrder.number",
      header: "Order",
      cell: ({ row }) => (
        <Link
          className="font-medium text-[var(--accent-strong)] underline-offset-2 hover:underline"
          href={`/work-orders/${row.original.workOrder.id}`}
        >
          {row.original.workOrder.number}
        </Link>
      ),
    },
    {
      id: "item",
      header: "Item",
      cell: ({ row }) => row.original.itemSku ?? "—",
    },
    {
      id: "wc",
      header: "Work center",
      cell: ({ row }) => row.original.workCenterCode ?? "—",
    },
    {
      id: "prog",
      header: "Progress",
      cell: ({ row }) => (
        <span className="tabular-nums text-xs">
          {row.original.workOrder.qtyCompleted}/{row.original.workOrder.qtyTarget}
        </span>
      ),
    },
    {
      accessorKey: "workOrder.status",
      header: "Status",
      cell: ({ row }) => (
        <StateBadge
          state={row.original.workOrder.status.toLowerCase()}
          size="sm"
        />
      ),
    },
    {
      accessorKey: "workOrder.dueAt",
      header: "Due",
      cell: ({ row }) =>
        row.original.workOrder.dueAt
          ? format(new Date(row.original.workOrder.dueAt), "MMM d")
          : "—",
    },
  ];

  if (loadError) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Work orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Schedule, execute, and track order-level progress
          </p>
        </div>
        {canWrite && (
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            disabled={items.length === 0}
          >
            <Plus className="size-3.5" />
            Create
          </Button>
        )}
      </div>

      {rows.length === 0 && canWrite && items.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">No work orders yet.</p>
          <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
            Create work order
          </Button>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={rows} searchPlaceholder="Search…" pageSize={8} />
          {canWrite && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Floor board
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Drag cards to change status. Dropping on Closed marks the order completed.
              </p>
              <KanbanBoard<KanbanWo>
                columns={kanbanColumns}
                onMove={onKanbanMove}
                renderCard={(item) => (
                  <div className="space-y-1">
                    <Link
                      href={`/work-orders/${item.id}`}
                      className="text-xs font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.number}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">{item.sku}</p>
                    <p className="text-[10px] tabular-nums">{item.qty}</p>
                  </div>
                )}
              />
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New work order</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wo-num">Number</Label>
              <Input
                id="wo-num"
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                placeholder="WO-2026-0500"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Item</Label>
              <Select
                value={form.itemId}
                onValueChange={(v) => {
                  if (v !== null) setForm((f) => ({ ...f, itemId: v }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.sku} — {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Work center</Label>
              <Select
                value={form.workCenterId || "__none__"}
                onValueChange={(v) => {
                  if (v !== null)
                    setForm((f) => ({
                      ...f,
                      workCenterId: v === "__none__" ? "" : v,
                    }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="wo-qty">Target qty</Label>
                <Input
                  id="wo-qty"
                  type="number"
                  value={form.qtyTarget}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, qtyTarget: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wo-pri">Priority</Label>
                <Input
                  id="wo-pri"
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Initial status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => {
                  if (v !== null)
                    setForm((f) => ({ ...f, status: v as WoStatus }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">PLANNED</SelectItem>
                  <SelectItem value="RELEASED">RELEASED</SelectItem>
                  <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                  <SelectItem value="ON_HOLD">ON_HOLD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-due">Due</Label>
              <Input
                id="wo-due"
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-notes">Notes</Label>
              <Input
                id="wo-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={saveNew}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
