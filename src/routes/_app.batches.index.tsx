import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Factory } from "lucide-react";
import { MetaListPage } from "@/components/kit/meta/meta-list-page";
import type { RowAction, TopTab } from "@/components/kit/meta/types";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button, StatusBadge } from "@/components/ui";
import { BatchFormDialog } from "@/components/mes/BatchFormDialog";
import { MesKitProvider } from "@/components/mes/MesKitProvider";
import { VoidBatchDialog } from "@/components/mes/VoidBatchDialog";
import { can } from "@/lib/permissions";
import { useRecordChanges } from "@/lib/record-changes";
import { apiUrl } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import { BATCH_OBJECT } from "@/lib/mes-list-config";
import { VOIDABLE_STATUSES, batchStatusLabel, batchStatusTone, type BatchStatus } from "@/lib/mes-domain";
import type { BatchDetail, BatchRow } from "@/lib/mes-types";
import type { QueryResult } from "@/lib/component-kit/types";
import type { AppUser } from "@/lib/users";

export const Route = createFileRoute("/_app/batches/")({
  component: BatchListPage,
});

type StatusCounts = Partial<Record<BatchStatus, number>>;

function BatchListPage() {
  const { user } = Route.useRouteContext() as { user: AppUser };
  const navigate = useNavigate();
  const canPlan = can(user.roles, "plan_batches");
  const canExecute = can(user.roles, "execute_batches");
  const [reloadKey, setReloadKey] = useState(0);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<BatchRow | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [voidTarget, setVoidTarget] = useState<BatchRow | null>(null);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  useRecordChanges(["mes_batches"], reload);

  const onDataLoaded = useCallback((result: QueryResult<Record<string, unknown>>) => {
    const next: StatusCounts = {};
    for (const group of result.groups ?? []) next[group.value as BatchStatus] = group.count;
    setCounts(next);
  }, []);

  const sum = (...statuses: BatchStatus[]) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  const topTabs: TopTab[] = [
    { key: "active", label: "进行中", scope: "ACTIVE", count: sum("DRAFT", "RELEASED", "FEEDING") },
    { key: "draft", label: "草稿", scope: "DRAFT", count: sum("DRAFT") },
    { key: "running", label: "待投料/投料中", scope: "RUNNING", count: sum("RELEASED", "FEEDING") },
    { key: "done", label: "已结束", scope: "DONE", count: sum("COMPLETED", "VOIDED") },
    { key: "all", label: "全部", count: sum("DRAFT", "RELEASED", "FEEDING", "COMPLETED", "VOIDED") },
  ];

  async function release() {
    if (!releaseTarget) return;
    setReleasing(true);
    try {
      const batch = await sendJson<BatchDetail>(apiUrl(`/api/batches/${releaseTarget.id}/release`), { method: "POST" });
      toast.success(`批次 ${batch.code} 已下达，已进入投料工位队列`);
      setReleaseTarget(null);
      reload();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setReleasing(false);
    }
  }

  function rowActions(raw: Record<string, unknown>): RowAction[] {
    const row = raw as unknown as BatchRow;
    return [
      {
        key: "release",
        label: "下达",
        tone: "primary",
        hidden: !canPlan || row.status !== "DRAFT",
        onClick: () => setReleaseTarget(row),
      },
      {
        key: "feed",
        label: "去投料",
        tone: "success",
        hidden: !canExecute || (row.status !== "RELEASED" && row.status !== "FEEDING"),
        onClick: () => void navigate({ to: "/station/feed/$batchId", params: { batchId: row.id } }),
      },
      {
        key: "detail",
        label: "详情",
        onClick: () => void navigate({ to: "/batches/$batchId", params: { batchId: row.id } }),
      },
      {
        key: "void",
        label: "作废",
        danger: true,
        hidden: !canPlan || !VOIDABLE_STATUSES.includes(row.status),
        onClick: () => setVoidTarget(row),
      },
    ];
  }

  return (
    <div className="page-shell flex min-h-full flex-col">
      <MesKitProvider roles={user.roles}>
        <MetaListPage
          objectCode={BATCH_OBJECT}
          title="生产批次"
          headerExtra={
            canExecute ? (
              <Button variant="outline" size="sm" icon={<Factory />} onClick={() => void navigate({ to: "/station/feed" })}>
                投料工位
              </Button>
            ) : null
          }
          createLabel="新建批次"
          onCreate={canPlan ? () => setCreateOpen(true) : undefined}
          topTabs={topTabs}
          defaultTopTab="active"
          reloadKey={reloadKey}
          onDataLoaded={onDataLoaded}
          selectable={false}
          importable={false}
          exportable={false}
          printable={false}
          onOpenRecord={(row) => void navigate({ to: "/batches/$batchId", params: { batchId: row.id } })}
          rowActions={rowActions}
          inlineActionCount={2}
          cellRenderers={{
            status: (row) => (
              <StatusBadge tone={batchStatusTone(String(row.status))}>{batchStatusLabel(String(row.status))}</StatusBadge>
            ),
            progress: (row) => {
              const done = Number(row.progressDone ?? 0);
              const total = Number(row.progressTotal ?? 0);
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="flex min-w-0 items-center gap-2" aria-label={`投料进度 ${done}/${total}`}>
                  <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-highlight" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
              );
            },
          }}
        />
      </MesKitProvider>

      {createOpen ? (
        <BatchFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={(batch) => void navigate({ to: "/batches/$batchId", params: { batchId: batch._id } })}
        />
      ) : null}

      <ConfirmDialog
        open={releaseTarget !== null}
        onOpenChange={(open) => {
          if (!open && !releasing) setReleaseTarget(null);
        }}
        title={`下达批次 ${releaseTarget?.code ?? ""}`}
        description={`下达后批次进入投料工位队列，配方步骤与计划投料量将锁定，不能再修改。产品：${releaseTarget?.productName ?? ""}，反应釜 ${releaseTarget?.reactor ?? ""}。`}
        confirmLabel="下达"
        pending={releasing}
        onConfirm={release}
      />

      <VoidBatchDialog
        batch={voidTarget}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        onVoided={() => {
          setVoidTarget(null);
          reload();
        }}
      />
    </div>
  );
}
