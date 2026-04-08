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

type WorkCenter = { id: string; code: string; name: string };
type EquipmentRow = {
  id: string;
  code: string;
  name: string;
  workCenterId: string;
  status: "RUNNING" | "IDLE" | "DOWN" | "MAINTENANCE";
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
};

type EqForm = {
  code: string;
  name: string;
  workCenterId: string;
  status: EquipmentRow["status"];
  availabilityPct: string;
  performancePct: string;
  qualityPct: string;
};

const emptyForm: EqForm = {
  code: "",
  name: "",
  workCenterId: "",
  status: "IDLE",
  availabilityPct: "92",
  performancePct: "88",
  qualityPct: "99",
};

export default function EquipmentPage() {
  const me = useMe();
  const canWrite = useCan(me?.role, "equipment:write");
  const canDelete = useCan(me?.role, "equipment:delete");

  const [centers, setCenters] = useState<WorkCenter[]>([]);
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);
  const [form, setForm] = useState<EqForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const centerLabel = useCallback(
    (id: string) => centers.find((c) => c.id === id)?.code ?? id,
    [centers],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    const [r1, r2] = await Promise.all([
      fetch(apiUrl("/api/work-centers")),
      fetch(apiUrl("/api/equipment")),
    ]);
    if (!r1.ok || !r2.ok) {
      setLoadError(await readError(!r1.ok ? r1 : r2));
      return;
    }
    setCenters(await r1.json());
    setRows(await r2.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      workCenterId: centers[0]?.id ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(row: EquipmentRow) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      workCenterId: row.workCenterId,
      status: row.status,
      availabilityPct: String(row.availabilityPct),
      performancePct: String(row.performancePct),
      qualityPct: String(row.qualityPct),
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        workCenterId: form.workCenterId,
        status: form.status,
        availabilityPct: Number(form.availabilityPct),
        performancePct: Number(form.performancePct),
        qualityPct: Number(form.qualityPct),
      };
      if (editing) {
        const res = await fetch(
          apiUrl(`/api/equipment?id=${encodeURIComponent(editing.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Equipment updated");
      } else {
        const res = await fetch(apiUrl("/api/equipment"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Equipment created");
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
      apiUrl(`/api/equipment?id=${encodeURIComponent(deleteId)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Equipment removed");
    setDeleteId(null);
    await load();
  }

  const columns: ColumnDef<EquipmentRow>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    {
      id: "wc",
      header: "Work center",
      cell: ({ row }) => centerLabel(row.original.workCenterId),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StateBadge state={row.original.status.toLowerCase()} size="sm" />
      ),
    },
    {
      accessorKey: "availabilityPct",
      header: "A%",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.availabilityPct}</span>
      ),
    },
    {
      accessorKey: "performancePct",
      header: "P%",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.performancePct}</span>
      ),
    },
    {
      accessorKey: "qualityPct",
      header: "Q%",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.qualityPct}</span>
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
          <h2 className="text-lg font-semibold">Equipment</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Assets tied to work centers with OEE inputs
          </p>
        </div>
        {canWrite && (
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            disabled={centers.length === 0}
          >
            <Plus className="size-3.5" />
            Create
          </Button>
        )}
      </div>

      {rows.length === 0 && canWrite && centers.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">No equipment yet.</p>
          <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
            Register equipment
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search…" pageSize={10} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit equipment" : "New equipment"}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-code">Code</Label>
              <Input
                id="eq-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-name">Name</Label>
              <Input
                id="eq-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Work center</Label>
              <Select
                value={form.workCenterId}
                onValueChange={(v) => {
                  if (v !== null) setForm((f) => ({ ...f, workCenterId: v }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => {
                  if (v !== null)
                    setForm((f) => ({ ...f, status: v as EquipmentRow["status"] }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUNNING">RUNNING</SelectItem>
                  <SelectItem value="IDLE">IDLE</SelectItem>
                  <SelectItem value="DOWN">DOWN</SelectItem>
                  <SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="eq-a">A%</Label>
                <Input
                  id="eq-a"
                  type="number"
                  value={form.availabilityPct}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, availabilityPct: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-p">P%</Label>
                <Input
                  id="eq-p"
                  type="number"
                  value={form.performancePct}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, performancePct: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-q">Q%</Label>
                <Input
                  id="eq-q"
                  type="number"
                  value={form.qualityPct}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, qualityPct: e.target.value }))
                  }
                />
              </div>
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
            <AlertDialogTitle>Delete equipment?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes this asset record from the floor model.
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
