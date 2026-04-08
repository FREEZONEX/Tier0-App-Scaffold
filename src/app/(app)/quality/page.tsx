"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { DataTable, StateBadge } from "@/components/mes";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/utils";
import { useMe, useCan, readError } from "@/lib/mes-client";

type Item = { id: string; sku: string; name: string };
type WorkOrder = { id: string; number: string };

type QeRow = {
  event: {
    id: string;
    workOrderId: string | null;
    itemId: string;
    lotCode: string | null;
    defectType: string;
    qtyAffected: number;
    status: "OPEN" | "INVESTIGATING" | "CLOSED";
    notes: string | null;
    reportedAt: string;
  };
  itemSku: string | null;
  itemName: string | null;
  workOrderNumber: string | null;
};

type QeForm = {
  itemId: string;
  workOrderId: string;
  lotCode: string;
  defectType: string;
  qtyAffected: string;
  status: QeRow["event"]["status"];
  notes: string;
};

const emptyForm: QeForm = {
  itemId: "",
  workOrderId: "",
  lotCode: "",
  defectType: "",
  qtyAffected: "1",
  status: "OPEN",
  notes: "",
};

export default function QualityPage() {
  const me = useMe();
  const canWrite = useCan(me?.role, "quality:write");

  const [items, setItems] = useState<Item[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [rows, setRows] = useState<QeRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QeRow["event"] | null>(null);
  const [form, setForm] = useState<QeForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const [r1, r2, r3] = await Promise.all([
      fetch(apiUrl("/api/items")),
      fetch(apiUrl("/api/work-orders")),
      fetch(apiUrl("/api/quality-events")),
    ]);
    if (!r1.ok || !r2.ok || !r3.ok) {
      const bad = !r1.ok ? r1 : !r2.ok ? r2 : r3;
      setLoadError(await readError(bad));
      return;
    }
    const woList = await r2.json();
    setItems(await r1.json());
    setWorkOrders(
      woList.map((x: { workOrder: WorkOrder }) => x.workOrder),
    );
    setRows(await r3.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      itemId: items[0]?.id ?? "",
      workOrderId: "",
    });
    setDialogOpen(true);
  }

  function openEdit(ev: QeRow["event"]) {
    setEditing(ev);
    setForm({
      itemId: ev.itemId,
      workOrderId: ev.workOrderId ?? "",
      lotCode: ev.lotCode ?? "",
      defectType: ev.defectType,
      qtyAffected: String(ev.qtyAffected),
      status: ev.status,
      notes: ev.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        itemId: form.itemId,
        workOrderId: form.workOrderId || null,
        lotCode: form.lotCode.trim() || null,
        defectType: form.defectType,
        qtyAffected: Number(form.qtyAffected),
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const res = await fetch(
          apiUrl(`/api/quality-events?id=${encodeURIComponent(editing.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Quality event updated");
      } else {
        const res = await fetch(apiUrl("/api/quality-events"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Quality event logged");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await fetch(
      apiUrl(`/api/quality-events?id=${encodeURIComponent(deleteId)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Event removed");
    setDeleteId(null);
    await load();
  }

  const columns: ColumnDef<QeRow>[] = [
    {
      accessorKey: "event.defectType",
      header: "Defect",
      cell: ({ row }) => row.original.event.defectType,
    },
    {
      id: "sku",
      header: "Item",
      cell: ({ row }) => row.original.itemSku ?? "—",
    },
    {
      id: "wo",
      header: "Work order",
      cell: ({ row }) =>
        row.original.event.workOrderId ? (
          <Link
            className="text-[var(--accent-strong)] underline-offset-2 hover:underline"
            href={`/work-orders/${row.original.event.workOrderId}`}
          >
            {row.original.workOrderNumber ?? row.original.event.workOrderId}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "event.qtyAffected",
      header: "Qty",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.event.qtyAffected}</span>
      ),
    },
    {
      accessorKey: "event.status",
      header: "Status",
      cell: ({ row }) => (
        <StateBadge state={row.original.event.status.toLowerCase()} size="sm" />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {canWrite && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => openEdit(row.original.event)}
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeleteId(row.original.event.id)}
                aria-label="Delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
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
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Quality</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Non-conformance tracking linked to items and work orders
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
            Log event
          </Button>
        )}
      </div>

      {rows.length === 0 && canWrite && items.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">No quality events yet.</p>
          <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
            Log first event
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search…" pageSize={10} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit event" : "Log quality event"}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2">
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
              <Label>Work order (optional)</Label>
              <Select
                value={form.workOrderId || "__none__"}
                onValueChange={(v) => {
                  if (v !== null)
                    setForm((f) => ({
                      ...f,
                      workOrderId: v === "__none__" ? "" : v,
                    }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {workOrders.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qe-lot">Lot code</Label>
              <Input
                id="qe-lot"
                value={form.lotCode}
                onChange={(e) => setForm((f) => ({ ...f, lotCode: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qe-def">Defect type</Label>
              <Input
                id="qe-def"
                value={form.defectType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defectType: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qe-qty">Quantity affected</Label>
              <Input
                id="qe-qty"
                type="number"
                value={form.qtyAffected}
                onChange={(e) =>
                  setForm((f) => ({ ...f, qtyAffected: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => {
                  if (v !== null)
                    setForm((f) => ({ ...f, status: v as typeof form.status }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="INVESTIGATING">INVESTIGATING</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qe-notes">Notes</Label>
              <Input
                id="qe-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this event?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes the quality record from the register.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
