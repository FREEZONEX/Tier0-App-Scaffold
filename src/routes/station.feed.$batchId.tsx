import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { AsyncView } from "@/components/data";
import { FieldGroup } from "@/components/forms";
import { NumberInput } from "@/components/kit/ui/number-input";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button, Card, RiskBanner, StatusBadge } from "@/components/ui";
import { BatchStepsTable } from "@/components/mes/BatchStepsTable";
import { useRequest } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import { useRecordChanges } from "@/lib/record-changes";
import { apiUrl, requestJson } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import {
  FEEDABLE_STATUSES,
  batchProgress,
  batchStatusLabel,
  batchStatusTone,
  formatKg,
  roundKg,
  stepRemainingMaxKg,
  stepWindow,
} from "@/lib/mes-domain";
import type { BatchDetail } from "@/lib/mes-types";
import type { AppUser } from "@/lib/users";

export const Route = createFileRoute("/station/feed/$batchId")({
  component: FeedBatchPage,
});

function FeedBatchPage() {
  const { batchId } = Route.useParams();
  const { user } = Route.useRouteContext() as { user: AppUser };
  const detail = useRequest(`mes:batch:${batchId}`, (signal) =>
    requestJson<BatchDetail>(`/api/batches/${encodeURIComponent(batchId)}`, { signal }),
  );
  useRecordChanges(["mes_batches"], () => detail.refresh(), { recordIds: [batchId] });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <AsyncView result={detail}>
        {(batch) => (
          <FeedBody
            key={`${batch._id}:${batch.revision}`}
            batch={batch}
            canExecute={can(user.roles, "execute_batches")}
            onChanged={detail.refresh}
          />
        )}
      </AsyncView>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-[4px] bg-surface-inset px-3 py-2">
      <p className="caption">{label}</p>
      <p className={strong ? "text-lg font-semibold tabular-nums" : "text-base tabular-nums"}>{value}</p>
    </div>
  );
}

function FeedBody({ batch, canExecute, onChanged }: { batch: BatchDetail; canExecute: boolean; onChanged: () => void }) {
  const navigate = useNavigate();
  const progress = batchProgress(batch.steps);
  const step = progress.current;
  const feedable = FEEDABLE_STATUSES.includes(batch.status);
  const suggested = step ? Math.min(roundKg(Math.max(0, step.plannedKg - step.fedKg)), stepRemainingMaxKg(step)) : null;
  const [qty, setQty] = useState<number | null>(suggested && suggested > 0 ? suggested : null);
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [feeding, setFeeding] = useState(false);
  const [output, setOutput] = useState<number | null>(batch.targetOutputKg);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function feed() {
    if (!step) return;
    const max = stepRemainingMaxKg(step);
    if (!qty || qty <= 0) {
      setQtyError("请输入本次投料量");
      return;
    }
    if (qty > max + 1e-9) {
      setQtyError(`超出上限，本步骤最多还能投 ${formatKg(max)}`);
      return;
    }
    setFeeding(true);
    try {
      const saved = await sendJson<BatchDetail>(apiUrl(`/api/batches/${batch._id}/feed`), {
        method: "POST",
        body: { seq: step.seq, qtyKg: qty, expectedRevision: batch.revision },
      });
      const savedStep = saved.steps.find((item) => item.seq === step.seq);
      toast.success(`步骤 ${step.seq} ${step.materialName} 投料 ${formatKg(qty)}，累计 ${formatKg(savedStep?.fedKg ?? 0)}`);
      onChanged();
    } catch (error) {
      toast.error(errorText(error));
      setFeeding(false);
    }
  }

  async function complete() {
    setCompleting(true);
    try {
      const saved = await sendJson<BatchDetail>(apiUrl(`/api/batches/${batch._id}/complete`), {
        method: "POST",
        body: { actualOutputKg: output, expectedRevision: batch.revision },
      });
      toast.success(`批次 ${saved.code} 已完工，产出 ${formatKg(saved.actualOutputKg ?? 0)}`);
      setCompleteOpen(false);
      void navigate({ to: "/station/feed" });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-xl font-semibold">{batch.code}</h1>
        <StatusBadge tone={batchStatusTone(batch.status)}>{batchStatusLabel(batch.status)}</StatusBadge>
        <span className="text-sm text-muted-foreground">
          {batch.productName} · {batch.reactor} · 目标 {formatKg(batch.targetOutputKg)}
        </span>
      </div>

      {!feedable ? (
        <RiskBanner severity="info">批次当前为「{batchStatusLabel(batch.status)}」，不在投料范围内。</RiskBanner>
      ) : !canExecute ? (
        <RiskBanner severity="info">当前角色只能查看，投料与完工需要操作员角色。</RiskBanner>
      ) : null}

      {feedable && step ? (
        <Card title={`当前步骤 ${step.seq}/${progress.total}`}>
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold">{step.materialName}</p>
              <p className="caption font-mono">{step.materialCode}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="计划量" value={formatKg(step.plannedKg)} />
              <Metric label="允许范围" value={`${stepWindow(step).minKg}–${stepWindow(step).maxKg} kg`} />
              <Metric label="已投" value={formatKg(step.fedKg)} strong />
              <Metric label="最多还能投" value={formatKg(stepRemainingMaxKg(step))} />
            </div>
            {canExecute ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <FieldGroup label="本次投料量" htmlFor="feed-qty" required error={qtyError ?? undefined} className="flex-1">
                  <NumberInput
                    id="feed-qty"
                    size="lg"
                    min={0.01}
                    precision={2}
                    suffix="kg"
                    value={qty}
                    onChange={(value) => {
                      setQty(value);
                      setQtyError(null);
                    }}
                    status={qtyError ? "error" : undefined}
                  />
                </FieldGroup>
                <Button
                  variant="highlight"
                  size="lg"
                  icon={<PackagePlus />}
                  loading={feeding}
                  disabled={feeding}
                  onClick={() => void feed()}
                  className="h-12 sm:min-w-40"
                >
                  确认投料
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {batch.status === "FEEDING" && progress.allDone ? (
        <Card title="全部步骤已达标">
          {canExecute ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FieldGroup label="实际产出" htmlFor="complete-output" required error={outputError ?? undefined} className="flex-1">
                <NumberInput
                  id="complete-output"
                  size="lg"
                  min={0.01}
                  precision={2}
                  suffix="kg"
                  value={output}
                  onChange={(value) => {
                    setOutput(value);
                    setOutputError(null);
                  }}
                  status={outputError ? "error" : undefined}
                />
              </FieldGroup>
              <Button
                variant="primary"
                size="lg"
                icon={<CheckCircle2 />}
                className="h-12 sm:min-w-40"
                onClick={() => {
                  if (!output || output <= 0) {
                    setOutputError("请填写实际产出");
                    return;
                  }
                  setCompleteOpen(true);
                }}
              >
                完工报工
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">等待操作员报工。</p>
          )}
        </Card>
      ) : null}

      <Card title="投料步骤" flush>
        <BatchStepsTable steps={batch.steps} bare />
      </Card>

      <ConfirmDialog
        open={completeOpen}
        onOpenChange={(open) => {
          if (!completing) setCompleteOpen(open);
        }}
        title={`批次 ${batch.code} 完工`}
        description={`实际产出 ${formatKg(output ?? 0)}（目标 ${formatKg(batch.targetOutputKg)}）。完工后批次关闭，不能再投料。`}
        confirmLabel="确认完工"
        pending={completing}
        onConfirm={complete}
      />
    </>
  );
}
