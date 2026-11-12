import { z } from "zod";
import { data, queryRequestToFind, toQueryResult, type Filter } from "@/lib/data";
import { batches, counters, type Batch } from "@/data/collections";
import { can } from "@/lib/permissions";
import { HttpError } from "@/lib/route-handlers";
import type { AppUser } from "@/lib/users";
import type { QueryRequest, QueryResult } from "@/lib/component-kit/types";
import {
  BATCH_STATUS_LABEL,
  FEEDABLE_STATUSES,
  VOIDABLE_STATUSES,
  batchProgress,
  formatKg,
  isStepDone,
  roundKg,
  stepRemainingMaxKg,
  type BatchEventAction,
  type BatchStatus,
} from "@/lib/mes-domain";
import type { BatchDetail, BatchRow, StationQueueItem } from "@/lib/mes-types";
import { staleRevision } from "./mes-errors";
import { getRecipeForBatch } from "./recipes";

const batchCollection = () => data.collection(batches);

export const createBatchInput = z.object({
  recipeId: z.string().trim().min(1, "请选择配方"),
  reactor: z.string().trim().min(1, "反应釜必填").max(16),
  targetOutputKg: z.number().gt(0, "目标产量须大于 0").max(100000),
  plannedStartAt: z.string().trim().min(1, "计划开工时间必填"),
});

export const editBatchInput = z.object({
  reactor: z.string().trim().min(1, "反应釜必填").max(16),
  targetOutputKg: z.number().gt(0, "目标产量须大于 0").max(100000),
  plannedStartAt: z.string().trim().min(1, "计划开工时间必填"),
  expectedRevision: z.number().int().min(1),
});

export const feedInput = z.object({
  seq: z.number().int().min(1),
  qtyKg: z.number().gt(0, "投料量须大于 0").max(100000),
  expectedRevision: z.number().int().min(1),
});

export const completeInput = z.object({
  actualOutputKg: z.number().gt(0, "实际产出须大于 0").max(100000),
  expectedRevision: z.number().int().min(1),
});

export const voidInput = z.object({
  reason: z.string().trim().min(2, "请填写作废原因（至少 2 个字）").max(200),
});

function requireAction(user: AppUser, action: "view_batches" | "plan_batches" | "execute_batches") {
  if (!can(user.roles, action)) {
    const label = { view_batches: "查看批次", plan_batches: "计划批次", execute_batches: "执行投料" }[action];
    throw new HttpError(403, `没有${label}的权限`);
  }
}

function actorName(user: AppUser): string {
  return user.displayName || user.username || user.id;
}

function event(user: AppUser, action: BatchEventAction, note?: string) {
  return { at: new Date().toISOString(), by: actorName(user), action, ...(note ? { note } : {}) };
}

function parseInstant(value: string, label: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${label}格式不正确`);
  return date.toISOString();
}

function toRow(batch: Batch): BatchRow {
  const progress = batchProgress(batch.steps);
  return {
    id: batch._id,
    code: batch.code,
    status: batch.status,
    recipeCode: batch.recipe.code,
    recipeName: batch.recipe.name,
    productName: batch.productName,
    reactor: batch.reactor,
    targetOutputKg: batch.targetOutputKg,
    plannedStartAt: batch.plannedStartAt,
    progressDone: progress.done,
    progressTotal: progress.total,
  };
}

function toDetail(batch: Batch): BatchDetail {
  return { ...batch, revision: batch._meta.revision };
}

async function loadBatch(id: string): Promise<Batch> {
  const { items } = await batchCollection().get([id]);
  const batch = items[0];
  if (!batch) throw new HttpError(404, "批次不存在");
  return batch;
}

function conflict(batch: Batch | null, expected: string): never {
  if (!batch) throw new HttpError(404, "批次不存在");
  throw new HttpError(
    409,
    `批次 ${batch.code} 当前为「${BATCH_STATUS_LABEL[batch.status] ?? batch.status}」，${expected}`,
  );
}

const STATUS_SCOPES: Record<string, BatchStatus[]> = {
  ACTIVE: ["DRAFT", "RELEASED", "FEEDING"],
  DRAFT: ["DRAFT"],
  RUNNING: ["RELEASED", "FEEDING"],
  DONE: ["COMPLETED", "VOIDED"],
};

export async function queryBatches(user: AppUser, request: QueryRequest): Promise<QueryResult<BatchRow>> {
  requireAction(user, "view_batches");
  const { filter, sort, page, pageSize } = queryRequestToFind(request, {
    paths: { recipeCode: "recipe.code", recipeName: "recipe.name" },
    instantFields: ["plannedStartAt"],
  });
  const scope = request.scope ? STATUS_SCOPES[request.scope] : undefined;
  const scoped: Filter = scope ? { $and: [filter, { status: { $in: scope } }] } : filter;
  const { list, byStatus } = await data.queryBatch({
    list: batchCollection().query.findPage(scoped, {
      sort: sort ?? { plannedStartAt: -1 },
      page,
      pageSize,
    }),
    byStatus: batchCollection().query.countBy("status", filter),
  });
  return toQueryResult(list, {
    map: toRow,
    groups: byStatus.map((entry) => ({
      value: String(entry.value),
      label: BATCH_STATUS_LABEL[entry.value as BatchStatus] ?? String(entry.value),
      count: entry.count,
    })),
  });
}

export async function getBatch(user: AppUser, id: string): Promise<BatchDetail> {
  requireAction(user, "view_batches");
  return toDetail(await loadBatch(id));
}

export async function listStationQueue(user: AppUser): Promise<StationQueueItem[]> {
  requireAction(user, "view_batches");
  const items = await batchCollection()
    .find({ status: { $in: [...FEEDABLE_STATUSES] } }, { sort: { plannedStartAt: 1 }, limit: 50 })
    .toArray();
  return items.map((batch) => {
    const progress = batchProgress(batch.steps);
    return {
      id: batch._id,
      code: batch.code,
      status: batch.status,
      productName: batch.productName,
      reactor: batch.reactor,
      targetOutputKg: batch.targetOutputKg,
      plannedStartAt: batch.plannedStartAt,
      progressDone: progress.done,
      progressTotal: progress.total,
      ...(progress.current
        ? { currentStep: `步骤 ${progress.current.seq} · ${progress.current.materialName}` }
        : {}),
    };
  });
}

async function nextBatchCode(): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await data.collection(counters).findOneAndUpdate(
    { _id: `batch-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  if (!counter) throw new HttpError(500, "批次编号生成失败");
  return `BAT-${year}-${String(counter.value).padStart(3, "0")}`;
}

function scaleSteps(steps: { seq: number; materialCode: string; materialName: string; tolerancePct: number }[], quantities: number[]) {
  return steps.map((step, index) => ({
    seq: step.seq,
    materialCode: step.materialCode,
    materialName: step.materialName,
    plannedKg: roundKg(quantities[index] ?? 0),
    tolerancePct: step.tolerancePct,
    fedKg: 0,
    feeds: [],
  }));
}

export async function createBatch(user: AppUser, input: z.infer<typeof createBatchInput>): Promise<BatchDetail> {
  requireAction(user, "plan_batches");
  const recipe = await getRecipeForBatch(input.recipeId);
  if (!recipe.active) throw new HttpError(409, `配方 ${recipe.code} 已停用，不能建批`);
  const ratio = input.targetOutputKg / recipe.baseOutputKg;
  const code = await nextBatchCode();
  const { value } = await batchCollection().insertOne(
    {
      code,
      status: "DRAFT",
      recipe: { id: recipe._id, code: recipe.code, name: recipe.name, version: recipe.version },
      productName: recipe.productName,
      reactor: input.reactor,
      targetOutputKg: roundKg(input.targetOutputKg),
      plannedStartAt: parseInstant(input.plannedStartAt, "计划开工时间"),
      steps: scaleSteps(recipe.steps, recipe.steps.map((step) => step.qtyKg * ratio)),
      history: [event(user, "CREATE")],
    },
    { returnDocument: "after" },
  );
  return toDetail(value);
}

export async function editDraftBatch(user: AppUser, id: string, input: z.infer<typeof editBatchInput>): Promise<BatchDetail> {
  requireAction(user, "plan_batches");
  const current = await loadBatch(id);
  if (current.status !== "DRAFT") conflict(current, "只有草稿可以修改");
  const ratio = input.targetOutputKg / current.targetOutputKg;
  const changes: string[] = [];
  if (current.reactor !== input.reactor) changes.push(`反应釜 ${current.reactor}→${input.reactor}`);
  if (current.targetOutputKg !== input.targetOutputKg) {
    changes.push(`目标产量 ${formatKg(current.targetOutputKg)}→${formatKg(input.targetOutputKg)}`);
  }
  const plannedStartAt = parseInstant(input.plannedStartAt, "计划开工时间");
  if (current.plannedStartAt !== plannedStartAt) changes.push("计划开工时间调整");
  const updated = await batchCollection().findOneAndUpdate(
    { _id: id, status: "DRAFT" },
    {
      $set: {
        reactor: input.reactor,
        targetOutputKg: roundKg(input.targetOutputKg),
        plannedStartAt,
        steps: scaleSteps(current.steps, current.steps.map((step) => step.plannedKg * ratio)),
      },
      $push: { history: event(user, "EDIT", changes.join("；") || undefined) },
    },
    { expectedRevision: input.expectedRevision, returnDocument: "after" },
  ).catch(staleRevision);
  if (!updated) conflict(await batchCollection().findOne({ _id: id }), "只有草稿可以修改");
  return toDetail(updated);
}

export async function releaseBatch(user: AppUser, id: string): Promise<BatchDetail> {
  requireAction(user, "plan_batches");
  const now = new Date().toISOString();
  const updated = await batchCollection().findOneAndUpdate(
    { _id: id, status: "DRAFT" },
    { $set: { status: "RELEASED", releasedAt: now }, $push: { history: event(user, "RELEASE") } },
    { returnDocument: "after" },
  );
  if (!updated) conflict(await batchCollection().findOne({ _id: id }), "只有草稿可以下达");
  return toDetail(updated);
}

export async function voidBatch(user: AppUser, id: string, reason: string): Promise<BatchDetail> {
  requireAction(user, "plan_batches");
  const now = new Date().toISOString();
  const updated = await batchCollection().findOneAndUpdate(
    { _id: id, status: { $in: [...VOIDABLE_STATUSES] } },
    {
      $set: { status: "VOIDED", voidedAt: now, voidReason: reason },
      $push: { history: event(user, "VOID", reason) },
    },
    { returnDocument: "after" },
  );
  if (!updated) conflict(await batchCollection().findOne({ _id: id }), "已完工或已作废的批次不能再作废");
  return toDetail(updated);
}

export async function feedBatch(user: AppUser, id: string, input: z.infer<typeof feedInput>): Promise<BatchDetail> {
  requireAction(user, "execute_batches");
  const current = await loadBatch(id);
  if (!FEEDABLE_STATUSES.includes(current.status)) conflict(current, "只有已下达或投料中的批次可以投料");
  const step = current.steps.find((candidate) => candidate.seq === input.seq);
  if (!step) throw new HttpError(404, `批次 ${current.code} 没有步骤 ${input.seq}`);
  const blocking = current.steps.find((candidate) => candidate.seq < step.seq && !isStepDone(candidate));
  if (blocking) {
    throw new HttpError(409, `请先完成步骤 ${blocking.seq}「${blocking.materialName}」的投料`);
  }
  const remaining = stepRemainingMaxKg(step);
  if (input.qtyKg > remaining + 1e-9) {
    throw new HttpError(
      409,
      `超量：步骤 ${step.seq}「${step.materialName}」最多还能投 ${formatKg(remaining)}`,
    );
  }
  const at = new Date().toISOString();
  const by = actorName(user);
  const steps = current.steps.map((candidate) =>
    candidate.seq === step.seq
      ? {
          ...candidate,
          fedKg: roundKg(candidate.fedKg + input.qtyKg),
          feeds: [...candidate.feeds, { qtyKg: roundKg(input.qtyKg), at, by }],
        }
      : candidate,
  );
  const updated = await batchCollection().findOneAndUpdate(
    { _id: id, status: { $in: [...FEEDABLE_STATUSES] } },
    {
      $set: { status: "FEEDING", steps },
      $push: {
        history: event(user, "FEED", `步骤 ${step.seq} ${step.materialName} ${formatKg(input.qtyKg)}`),
      },
    },
    { expectedRevision: input.expectedRevision, returnDocument: "after" },
  ).catch(staleRevision);
  if (!updated) conflict(await batchCollection().findOne({ _id: id }), "只有已下达或投料中的批次可以投料");
  return toDetail(updated);
}

export async function completeBatch(user: AppUser, id: string, input: z.infer<typeof completeInput>): Promise<BatchDetail> {
  requireAction(user, "execute_batches");
  const current = await loadBatch(id);
  if (current.status !== "FEEDING") conflict(current, "只有投料中的批次可以完工");
  const progress = batchProgress(current.steps);
  if (!progress.allDone) {
    throw new HttpError(409, `尚有投料步骤未达下限（${progress.done}/${progress.total}）`);
  }
  const now = new Date().toISOString();
  const updated = await batchCollection().findOneAndUpdate(
    { _id: id, status: "FEEDING" },
    {
      $set: { status: "COMPLETED", completedAt: now, actualOutputKg: roundKg(input.actualOutputKg) },
      $push: { history: event(user, "COMPLETE", `实际产出 ${formatKg(input.actualOutputKg)}`) },
    },
    { expectedRevision: input.expectedRevision, returnDocument: "after" },
  ).catch(staleRevision);
  if (!updated) conflict(await batchCollection().findOne({ _id: id }), "只有投料中的批次可以完工");
  return toDetail(updated);
}
