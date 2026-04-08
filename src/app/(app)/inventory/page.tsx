"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

type LotRow = {
  lot: {
    id: string;
    itemId: string;
    lotCode: string;
    qtyOnHand: number;
    location: string;
    status: "AVAILABLE" | "QUARANTINE" | "CONSUMED";
    receivedAt: string;
  };
  itemSku: string | null;
  itemName: string | null;
};

type LotForm = {
  itemId: string;
  lotCode: string;
  qtyOnHand: string;
  location: string;
  status: LotRow["lot"]["status"];
};

const emptyForm: LotForm = {
  itemId: "",
  lotCode: "",
  qtyOnHand: "0",
  location: "",
  status: "AVAILABLE",
};

export default function InventoryPage() {
  const me = useMe();
  const canWrite = useCan(me?.role, "inventory:write");

  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<LotRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LotRow["lot"] | null>(null);
  const [form, setForm] = useState<LotForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const [r1, r2] = await Promise.all([
      fetch(apiUrl("/api/items")),
      fetch(apiUrl("/api/inventory-lots")),
    ]);
    if (!r1.ok || !r2.ok) {
      setLoadError(await readError(!r1.ok ? r1 : r2));
      return;
    }
    setItems(await r1.json());
    setRows(await r2.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      itemId: items[0]?.id ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(lot: LotRow["lot"]) {
    setEditing(lot);
    setForm({
      itemId: lot.itemId,
      lotCode: lot.lotCode,
      qtyOnHand: String(lot.qtyOnHand),
      location: lot.location,
      status: lot.status,
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        itemId: form.itemId,
        lotCode: form.lotCode,
        qtyOnHand: Number(form.qtyOnHand),
        location: form.location,
        status: form.status,
      };
      if (editing) {
        const res = await fetch(
          apiUrl(`/api/inventory-lots?id=${encodeURIComponent(editing.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Lot updated");
      } else {
        const res = await fetch(apiUrl("/api/inventory-lots"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Lot received");
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
      apiUrl(`/api/inventory-lots?id=${encodeURIComponent(deleteId)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Lot removed");
    setDeleteId(null);
    await load();
  }

  const columns: ColumnDef<LotRow>[] = [
    { accessorKey: "lot.lotCode", header: "Lot", cell: ({ row }) => row.original.lot.lotCode },
    {
      id: "sku",
      header: "Item",
      cell: ({ row }) => row.original.itemSku ?? "—",
    },
    {
      accessorKey: "lot.qtyOnHand",
      header: "Qty",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.lot.qtyOnHand}</span>
      ),
    },
    { accessorKey: "lot.location", header: "Location" },
    {
      accessorKey: "lot.status",
      header: "Status",
      cell: ({ row }) => (
        <StateBadge state={row.original.lot.status.toLowerCase()} size="sm" />
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
                onClick={() => openEdit(row.original.lot)}
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeleteId(row.original.lot.id)}
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
          <h2 className="text-lg font-semibold">Inventory</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lots on hand by location and disposition
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
            Receive lot
          </Button>
        )}
      </div>

      {rows.length === 0 && canWrite && items.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">No inventory lots yet.</p>
          <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
            Receive first lot
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search…" pageSize={10} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lot" : "Receive inventory lot"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
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
              <Label htmlFor="lot-code">Lot code</Label>
              <Input
                id="lot-code"
                value={form.lotCode}
                onChange={(e) => setForm((f) => ({ ...f, lotCode: e.target.value }))}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lot-qty">Quantity on hand</Label>
              <Input
                id="lot-qty"
                type="number"
                value={form.qtyOnHand}
                onChange={(e) =>
                  setForm((f) => ({ ...f, qtyOnHand: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lot-loc">Location</Label>
              <Input
                id="lot-loc"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
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
                  <SelectItem value="AVAILABLE">AVAILABLE</SelectItem>
                  <SelectItem value="QUARANTINE">QUARANTINE</SelectItem>
                  <SelectItem value="CONSUMED">CONSUMED</SelectItem>
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Delete lot?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes this lot record from inventory.
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
