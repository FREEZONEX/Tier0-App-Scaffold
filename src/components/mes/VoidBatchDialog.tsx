"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, OverlayActionButton } from "@/components/overlays";
import { FieldGroup } from "@/components/forms";
import { RiskBanner } from "@/components/ui";
import { apiUrl } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import { batchStatusLabel } from "@/lib/mes-domain";
import type { BatchDetail } from "@/lib/mes-types";

interface VoidTarget {
  id: string;
  code: string;
  status: string;
  productName: string;
}

/** Void a batch with a mandatory reason; the reason is kept in the batch history. */
export function VoidBatchDialog({
  batch,
  onOpenChange,
  onVoided,
}: {
  batch: VoidTarget | null;
  onOpenChange: (open: boolean) => void;
  onVoided: (batch: BatchDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    setReason("");
    setError(null);
    onOpenChange(false);
  }

  async function submit() {
    if (!batch) return;
    if (reason.trim().length < 2) {
      setError("请填写作废原因（至少 2 个字）");
      return;
    }
    setPending(true);
    try {
      const voided = await sendJson<BatchDetail>(apiUrl(`/api/batches/${batch.id}/void`), {
        method: "POST",
        body: { reason: reason.trim() },
      });
      toast.success(`批次 ${voided.code} 已作废`);
      setReason("");
      setError(null);
      onVoided(voided);
    } catch (requestError) {
      toast.error(errorText(requestError));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={batch !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={`作废批次 ${batch?.code ?? ""}`}
      size="sm"
      footer={
        <>
          <OverlayActionButton action={{ label: "取消", variant: "outline", disabled: pending }} onDefaultClick={close} />
          <OverlayActionButton
            action={{ label: "作废批次", variant: "destructive", disabled: pending, loading: pending }}
            onDefaultClick={() => void submit()}
          />
        </>
      }
    >
      <div className="space-y-4">
        <RiskBanner severity="warning">
          {batch ? `${batch.productName} · 当前「${batchStatusLabel(batch.status)}」。` : null}
          作废后批次从投料工位撤下，已投物料需按现场规程处理，此操作不可撤销。
        </RiskBanner>
        <FieldGroup label="作废原因" htmlFor="void-reason" required error={error ?? undefined}>
          <textarea
            id="void-reason"
            required
            rows={3}
            maxLength={200}
            className="w-full"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError(null);
            }}
            placeholder="例如：原料批次待检，计划取消"
          />
        </FieldGroup>
      </div>
    </Dialog>
  );
}
