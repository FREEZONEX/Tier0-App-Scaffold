/**
 * Batch MES domain rules shared by services and pages. Pure: no data access.
 */
import type { StatusTone } from "@/components/ui/status-badge";

export type BatchStatus = "DRAFT" | "RELEASED" | "FEEDING" | "COMPLETED" | "VOIDED";
export type BatchEventAction = "CREATE" | "EDIT" | "RELEASE" | "FEED" | "COMPLETE" | "VOID";

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  DRAFT: "草稿",
  RELEASED: "已下达",
  FEEDING: "投料中",
  COMPLETED: "已完工",
  VOIDED: "已作废",
};

export const BATCH_STATUS_TONE: Record<BatchStatus, StatusTone> = {
  DRAFT: "idle",
  RELEASED: "info",
  FEEDING: "running",
  COMPLETED: "running",
  VOIDED: "error",
};

export const BATCH_EVENT_LABEL: Record<BatchEventAction, string> = {
  CREATE: "创建",
  EDIT: "修改",
  RELEASE: "下达",
  FEED: "投料",
  COMPLETE: "完工",
  VOID: "作废",
};

/** Statuses an operator can feed into. */
export const FEEDABLE_STATUSES: readonly BatchStatus[] = ["RELEASED", "FEEDING"];
/** Statuses a planner can still void. */
export const VOIDABLE_STATUSES: readonly BatchStatus[] = ["DRAFT", "RELEASED", "FEEDING"];

export function batchStatusLabel(status: string): string {
  return BATCH_STATUS_LABEL[status as BatchStatus] ?? status;
}

export function batchStatusTone(status: string): StatusTone {
  return BATCH_STATUS_TONE[status as BatchStatus] ?? "idle";
}

export function roundKg(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatKg(value: number): string {
  return `${roundKg(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} kg`;
}

export interface StepQuantities {
  plannedKg: number;
  tolerancePct: number;
  fedKg: number;
}

/** Accepted fed range of one step: planned ± tolerance. */
export function stepWindow(step: Pick<StepQuantities, "plannedKg" | "tolerancePct">) {
  const delta = (step.plannedKg * step.tolerancePct) / 100;
  return { minKg: roundKg(step.plannedKg - delta), maxKg: roundKg(step.plannedKg + delta) };
}

export function isStepDone(step: StepQuantities): boolean {
  return step.fedKg + 1e-9 >= stepWindow(step).minKg;
}

/** Quantity that may still be fed into a step without exceeding its upper limit. */
export function stepRemainingMaxKg(step: StepQuantities): number {
  return Math.max(0, roundKg(stepWindow(step).maxKg - step.fedKg));
}

export function batchProgress<S extends StepQuantities & { seq: number }>(steps: readonly S[]) {
  const done = steps.filter(isStepDone).length;
  const current = steps.find((step) => !isStepDone(step));
  return { done, total: steps.length, current, allDone: done === steps.length };
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}