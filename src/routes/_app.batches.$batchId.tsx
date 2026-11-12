import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Factory, PenLine, Send, XCircle } from "lucide-react";
import { AsyncView } from "@/components/data";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button, Card, PageHeader, RiskBanner, StatusBadge, Timeline } from "@/components/ui";
import { BatchFormDialog } from "@/components/mes/BatchFormDialog";
import { BatchStepsTable } from "@/components/mes/BatchStepsTable";
import { VoidBatchDialog } from "@/components/mes/VoidBatchDialog";
import { useRequest } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import { useRecordChanges } from "@/lib/record-changes";
import { apiUrl, requestJson } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import {
  BATCH_EVENT_LABEL,
  FEEDABLE_STATUSES,
  VOIDABLE_STATUSES,
  batchProgress,
  batchStatusLabel,
  batchStatusTone,
  formatDateTime,
  formatKg,
  type BatchEventAction,
} from "@/lib/mes-domain";
import type { BatchDetail } from "@/lib/mes-types";
import type { AppUser } from "@/lib/users";

export const Route = createFileRoute("/_app/batches/$batchId")({
  component: BatchDetailPage,
});

const EVENT_TONE: Record<BatchEventAction, "default" | "running" | "info" | "error"> = {
  CREATE: "default",
  EDIT: "default",
  RELEASE: "info",
  FEED: "running",
  COMPLETE: "running",
  VOID: "error",
};

function BatchDetailPage() {
  const { batchId } = Route.useParams();
  const { user } = Route.useRouteContext() as { user: AppUser };
  const detail = useRequest(`mes:batch:${batchId}`, (signal) =>
    requestJson<BatchDetail>(`/api/batches/${encodeURIComponent(batchId)}`, { signal }),
  );
  useRecordChanges(["mes_batches"], () => detail.refresh(), { recordIds: [batchId] });

  return (
    <div className="page-shell space-y-5">
      <AsyncView result={detail}>
        {(batch) => <BatchDetailBody batch={batch} user={user} onChanged={detail.refresh} />}
      </AsyncView>
    </div>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="caption">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

function BatchDetailBody({ batch, user, onChanged }: { batch: BatchDetail; user: AppUser; onChanged: () => void }) {
  const navigate = useNavigate();
  const canPlan = can(user.roles, "plan_batches");
  const canExecute = can(user.roles, "execute_batches");
  const [editOpen, setEditOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const progress = batchProgress(batch.steps);

  async function release() {
    setReleasing(true);
    try {
      await sendJson<BatchDetail>(apiUrl(`/api/batches/${batch._id}/release`), { method: "POST" });
      toast.success(`批次 ${batch.code} 已下达，已进入投料工位队列`);
      setReleaseOpen(false);
      onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setReleasing(false);
    }
  }

  const history = [...batch.history].reverse();

  return (
    <>
      <PageHeader
        back={{ to: "/batches", label: "生产批次" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {batch.code}
            <StatusBadge tone={batchStatusTone(batch.status)}>{batchStatusLabel(batch.status)}</StatusBadge>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canPlan && batch.status === "DRAFT" ? (
              <>
                <Button variant="outline" icon={<PenLine />} onClick={() => setEditOpen(true)}>
                  修改
                </Button>
                <Button variant="primary" icon={<Send />} onClick={() => setReleaseOpen(true)}>
                  下达
                </Button>
              </>
            ) : null}
            {canExecute && FEEDABLE_STATUSES.includes(batch.status) ? (
              <Button
                variant="highlight"
                icon={<Factory />}
                onClick={() => void navigate({ to: "/station/feed/$batchId", params: { batchId: batch._id } })}
              >
                去投料
              </Button>
            ) : null}
            {canPlan && VOIDABLE_STATUSES.includes(batch.status) ? (
              <Button variant="danger" icon={<XCircle />} onClick={() => setVoidOpen(true)}>
                作废
              </Button>
            ) : null}
          </div>
        }
      />

      {batch.status === "VOIDED" && batch.voidReason ? (
        <RiskBanner severity="error">作废原因：{batch.voidReason}</RiskBanner>
      ) : null}

      <Card title="批次信息">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <InfoItem label="配方">
            {batch.recipe.code} · {batch.recipe.name}（{batch.recipe.version}）
          </InfoItem>
          <InfoItem label="产品">{batch.productName}</InfoItem>
          <InfoItem label="反应釜">{batch.reactor}</InfoItem>
          <InfoItem label="目标产量">{formatKg(batch.targetOutputKg)}</InfoItem>
          <InfoItem label="实际产出">{batch.actualOutputKg !== undefined ? formatKg(batch.actualOutputKg) : "—"}</InfoItem>
          <InfoItem label="计划开工">{formatDateTime(batch.plannedStartAt)}</InfoItem>
          <InfoItem label="下达时间">{formatDateTime(batch.releasedAt)}</InfoItem>
          <InfoItem label="完工时间">{formatDateTime(batch.completedAt)}</InfoItem>
          <InfoItem label="投料进度">
            {progress.done}/{progress.total} 步
          </InfoItem>
        </dl>
      </Card>

      <Card title="投料步骤" flush>
        <BatchStepsTable steps={batch.steps} bare />
      </Card>

      <Card title="操作记录">
        <Timeline
          items={history.map((entry, index) => ({
            id: `${entry.at}-${index}`,
            title: `${entry.by} ${BATCH_EVENT_LABEL[entry.action] ?? entry.action}`,
            meta: formatDateTime(entry.at),
            ...(entry.note ? { detail: entry.note } : {}),
            tone: EVENT_TONE[entry.action] ?? "default",
          }))}
        />
      </Card>

      {editOpen ? (
        <BatchFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          batch={batch}
          onSaved={() => onChanged()}
        />
      ) : null}

      <ConfirmDialog
        open={releaseOpen}
        onOpenChange={(open) => {
          if (!releasing) setReleaseOpen(open);
        }}
        title={`下达批次 ${batch.code}`}
        description={`下达后批次进入投料工位队列，${batch.steps.length} 个投料步骤与计划量将锁定，不能再修改。`}
        confirmLabel="下达"
        pending={releasing}
        onConfirm={release}
      />

      <VoidBatchDialog
        batch={voidOpen ? { id: batch._id, code: batch.code, status: batch.status, productName: batch.productName } : null}
        onOpenChange={setVoidOpen}
        onVoided={() => {
          setVoidOpen(false);
          onChanged();
        }}
      />
    </>
  );
}
