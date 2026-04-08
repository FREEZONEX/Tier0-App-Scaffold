"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiUrl } from "@/lib/utils";
import { useMe, useCan, readError } from "@/lib/mes-client";

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

type WoDetail = {
  workOrder: WorkOrder;
  itemSku: string | null;
  itemName: string | null;
  workCenterCode: string | null;
  workCenterName: string | null;
};

type Op = {
  id: string;
  workOrderId: string;
  sequence: number;
  description: string;
  plannedQty: number;
  completedQty: number;
  status: "PENDING" | "RUNNING" | "DONE";
};

type OpForm = {
  sequence: string;
  description: string;
  plannedQty: string;
  status: Op["status"];
};

const emptyOp: OpForm = {
  sequence: "10",
  description: "",
  plannedQty: "0",
  status: "PENDING",
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const me = useMe();
  const canWriteWo = useCan(me?.role, "work_orders:write");
  const canDeleteWo = useCan(me?.role, "work_orders:delete");
  const canWriteOp = useCan(me?.role, "operations:write");

  const [detail, setDetail] = useState<WoDetail | null>(null);
  const [ops, setOps] = useState<Op[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opDialog, setOpDialog] = useState(false);
  const [editingOp, setEditingOp] = useState<Op | null>(null);
  const [opForm, setOpForm] = useState<OpForm>(emptyOp);
  const [deleteOpId, setDeleteOpId] = useState<string | null>(null);
  const [deleteWo, setDeleteWo] = useState(false);
  const [saving, setSaving] = useState(false);

  const [statusEdit, setStatusEdit] = useState<WoStatus | "">("");
  const [qtyCompleted, setQtyCompleted] = useState("");
  const [notesEdit, setNotesEdit] = useState("");

  const load = useCallback(async () => {
    setLoadError(null);
    const [r1, r2] = await Promise.all([
      fetch(apiUrl(`/api/work-orders?id=${encodeURIComponent(id)}`)),
      fetch(
        apiUrl(
          `/api/work-order-operations?workOrderId=${encodeURIComponent(id)}`,
        ),
      ),
    ]);
    if (!r1.ok) {
      setLoadError(await readError(r1));
      return;
    }
    const d: WoDetail = await r1.json();
    setDetail(d);
    setStatusEdit(d.workOrder.status);
    setQtyCompleted(String(d.workOrder.qtyCompleted));
    setNotesEdit(d.workOrder.notes ?? "");
    if (r2.ok) setOps(await r2.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveHeader() {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(
        apiUrl(`/api/work-orders?id=${encodeURIComponent(id)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: statusEdit,
            qtyCompleted: Number(qtyCompleted),
            notes: notesEdit.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error(await readError(res));
      toast.success("Work order updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeWo() {
    const res = await fetch(
      apiUrl(`/api/work-orders?id=${encodeURIComponent(id)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Work order deleted");
    router.push("/work-orders");
  }

  function openCreateOp() {
    setEditingOp(null);
    setOpForm({
      ...emptyOp,
      sequence: String((ops[ops.length - 1]?.sequence ?? 0) + 10),
    });
    setOpDialog(true);
  }

  function openEditOp(op: Op) {
    setEditingOp(op);
    setOpForm({
      sequence: String(op.sequence),
      description: op.description,
      plannedQty: String(op.plannedQty),
      status: op.status,
    });
    setOpDialog(true);
  }

  async function saveOp() {
    setSaving(true);
    try {
      if (editingOp) {
        const res = await fetch(
          apiUrl(`/api/work-order-operations?id=${encodeURIComponent(editingOp.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sequence: Number(opForm.sequence),
              description: opForm.description,
              plannedQty: Number(opForm.plannedQty),
              status: opForm.status,
            }),
          },
        );
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Operation updated");
      } else {
        const res = await fetch(apiUrl("/api/work-order-operations"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workOrderId: id,
            sequence: Number(opForm.sequence),
            description: opForm.description,
            plannedQty: Number(opForm.plannedQty),
            status: opForm.status,
          }),
        });
        if (!res.ok) throw new Error(await readError(res));
        toast.success("Operation added");
      }
      setOpDialog(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteOp() {
    if (!deleteOpId) return;
    const res = await fetch(
      apiUrl(`/api/work-order-operations?id=${encodeURIComponent(deleteOpId)}`),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success("Operation removed");
    setDeleteOpId(null);
    await load();
  }

  const opColumns: ColumnDef<Op>[] = [
    {
      accessorKey: "sequence",
      header: "#",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.sequence}</span>
      ),
    },
    { accessorKey: "description", header: "Operation" },
    {
      accessorKey: "plannedQty",
      header: "Planned",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.plannedQty}</span>
      ),
    },
    {
      accessorKey: "completedQty",
      header: "Done",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.completedQty}</span>
      ),
    },
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
      cell: ({ row }) =>
        canWriteOp ? (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => openEditOp(row.original)}
              aria-label="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setDeleteOpId(row.original.id)}
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  if (loadError || !detail) {
    return (
      <div className="p-6">
        <Link
          href="/work-orders"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back
        </Link>
        <p className="mt-4 text-sm text-destructive">
          {loadError ?? "Loading…"}
        </p>
      </div>
    );
  }

  const wo = detail.workOrder;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/work-orders"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            All work orders
          </Link>
          <h2 className="mt-2 text-lg font-semibold">{wo.number}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {detail.itemSku} — {detail.itemName}
            {detail.workCenterCode && (
              <> · {detail.workCenterCode}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StateBadge state={wo.status.toLowerCase()} />
          {wo.dueAt && (
            <span className="text-xs text-muted-foreground">
              Due {format(new Date(wo.dueAt), "MMM d, yyyy HH:mm")}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Order control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canWriteWo ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={statusEdit}
                      onValueChange={(v) => {
                        if (v !== null) setStatusEdit(v as WoStatus);
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
                        <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                        <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wo-qty-done">Qty completed</Label>
                    <Input
                      id="wo-qty-done"
                      type="number"
                      value={qtyCompleted}
                      onChange={(e) => setQtyCompleted(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wo-notes">Notes</Label>
                  <Input
                    id="wo-notes"
                    value={notesEdit}
                    onChange={(e) => setNotesEdit(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={saveHeader}
                  >
                    Save changes
                  </Button>
                  {canDeleteWo && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteWo(true)}
                    >
                      Delete order
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                You do not have permission to edit this work order.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Target {wo.qtyTarget} · Priority {wo.priority}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Operations
            </CardTitle>
            {canWriteOp && (
              <Button type="button" size="xs" variant="outline" onClick={openCreateOp}>
                <Plus className="size-3" />
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {ops.length === 0 && canWriteOp ? (
              <div className="py-6 text-center">
                <p className="text-xs text-muted-foreground">No operations.</p>
                <Button
                  type="button"
                  className="mt-3"
                  size="sm"
                  onClick={openCreateOp}
                >
                  Add operation
                </Button>
              </div>
            ) : (
              <DataTable
                columns={opColumns}
                data={ops}
                searchPlaceholder=""
                pageSize={8}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={opDialog} onOpenChange={setOpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOp ? "Edit operation" : "New operation"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="op-seq">Sequence</Label>
              <Input
                id="op-seq"
                type="number"
                value={opForm.sequence}
                onChange={(e) =>
                  setOpForm((f) => ({ ...f, sequence: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-desc">Description</Label>
              <Input
                id="op-desc"
                value={opForm.description}
                onChange={(e) =>
                  setOpForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-plan">Planned qty</Label>
              <Input
                id="op-plan"
                type="number"
                value={opForm.plannedQty}
                onChange={(e) =>
                  setOpForm((f) => ({ ...f, plannedQty: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={opForm.status}
                onValueChange={(v) => {
                  if (v !== null)
                    setOpForm((f) => ({ ...f, status: v as Op["status"] }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="RUNNING">RUNNING</SelectItem>
                  <SelectItem value="DONE">DONE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpDialog(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={saveOp}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOpId} onOpenChange={() => setDeleteOpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove operation?</AlertDialogTitle>
            <AlertDialogDescription>
              This step is removed from the routing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteOp}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteWo} onOpenChange={setDeleteWo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete work order?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes {wo.number} and its operations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeWo}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
