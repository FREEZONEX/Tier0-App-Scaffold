"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/mes";
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
import { apiUrl } from "@/lib/utils";
import { useMe, useCan, readError } from "@/lib/mes-client";

type Item = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  category: string | null;
};

const emptyForm = { sku: "", name: "", uom: "EA", category: "" };

export default function ItemsPage() {
  const me = useMe();
  const canWrite = useCan(me?.role, "items:write");
  const canDelete = useCan(me?.role, "items:delete");

  const [rows, setRows] = useState<Item[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(apiUrl("/api/items"));
    if (!res.ok) {
      setLoadError(await readError(res));
      return;
    }
    setRows(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: Item) {
    setEditing(row);
    setForm({
      sku: row.sku,
      name: row.name,
      uom: row.uom,
      category: row.category ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        uom: form.uom,
        category: form.category.trim() || null,
      };
      if (editing) {
        const res = await fetch(
          apiUrl(`/api/items?id=${encodeURIComponent(editing.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Item updated");
      } else {
        const res = await fetch(apiUrl("/api/items"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Item created");
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
      apiUrl(`/api/items?id=${encodeURIComponent(deleteId)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Item deleted");
    setDeleteId(null);
    await load();
  }

  const columns: ColumnDef<Item>[] = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "uom", header: "UoM" },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => row.original.category ?? "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {canWrite && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => openEdit(row.original)}
              aria-label="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setDeleteId(row.original.id)}
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
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
          <h2 className="text-lg font-semibold">Items</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Materials and finished goods master data
          </p>
        </div>
        {canWrite && (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-3.5" />
            Create
          </Button>
        )}
      </div>

      {rows.length === 0 && canWrite ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">No items yet.</p>
          <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
            Create item
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search…" pageSize={10} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="it-sku">SKU</Label>
              <Input
                id="it-sku"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-name">Name</Label>
              <Input
                id="it-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-uom">Unit of measure</Label>
              <Input
                id="it-uom"
                value={form.uom}
                onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-cat">Category</Label>
              <Input
                id="it-cat"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
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
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this SKU from the catalog. References may block deletion.
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
