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

type WorkCenter = {
  id: string;
  code: string;
  name: string;
  area: string;
  status: "ACTIVE" | "INACTIVE";
};

type WcForm = {
  code: string;
  name: string;
  area: string;
  status: WorkCenter["status"];
};

const emptyForm: WcForm = { code: "", name: "", area: "", status: "ACTIVE" };

export default function WorkCentersPage() {
  const me = useMe();
  const canWrite = useCan(me?.role, "work_centers:write");
  const canDelete = useCan(me?.role, "work_centers:delete");

  const [rows, setRows] = useState<WorkCenter[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCenter | null>(null);
  const [form, setForm] = useState<WcForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(apiUrl("/api/work-centers"));
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

  function openEdit(row: WorkCenter) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      area: row.area,
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(
          apiUrl(`/api/work-centers?id=${encodeURIComponent(editing.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: form.code,
              name: form.name,
              area: form.area,
              status: form.status,
            }),
          },
        );
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Work center updated");
      } else {
        const res = await fetch(apiUrl("/api/work-centers"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Work center created");
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
      apiUrl(`/api/work-centers?id=${encodeURIComponent(deleteId)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Work center deleted");
    setDeleteId(null);
    await load();
  }

  const columns: ColumnDef<WorkCenter>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "area", header: "Area" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StateBadge state={row.original.status.toLowerCase()} size="sm" />
      ),
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
          <h2 className="text-lg font-semibold">Work centers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Production lines and logical manufacturing areas
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
          <p className="text-xs text-muted-foreground">No work centers yet.</p>
          <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
            Create work center
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search…" pageSize={10} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit work center" : "New work center"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wc-code">Code</Label>
              <Input
                id="wc-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wc-name">Name</Label>
              <Input
                id="wc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wc-area">Area</Label>
              <Input
                id="wc-area"
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => {
                  if (v !== null)
                    setForm((f) => ({ ...f, status: v as "ACTIVE" | "INACTIVE" }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
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
            <AlertDialogTitle>Delete work center?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone if no equipment or orders reference it.
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
