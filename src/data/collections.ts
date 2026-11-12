/**
 * App collections — the single source of truth for stored data.
 *
 * Every collection is declared here with `defineCollection(...)` and listed in
 * `collections`. On first data access the App ensures the whole list in one
 * batch: missing collections are created (and seeded), wider declarations
 * widen storage, and nothing is ever narrowed or dropped from here. Preview
 * and the deployed App share the same collections — never `deleteMany` to
 * "reset" a schema. Rules: AGENTS.md → App Data.
 *
 * Declare each collection's directoryPath from the workspace root using real
 * business names. Inspect/reuse existing directories; industrial data follows
 * the known ISA-95 equipment hierarchy. Shared data uses its common ancestor.
 * An App/module directory (e.g. MES) may follow the known factory/line scope;
 * never default to a root App container or invent missing facilities.
 *
 * Collection schemas are storage schemas: plain `z.object`, `z.string()`,
 * `z.number()` / `.int()` with optional `.min()` / `.max()`, `z.boolean()`,
 * `z.enum([...])`, `z.array(...)`, nested objects and `.optional()`. No
 * `.nullable()`, `.default()`, string formats or length limits — keep those
 * in API input schemas. `npm run build` rejects anything UNS cannot store.
 */
import { z } from "zod";
import { defineCollection, type Doc } from "@tier0/sdk-v2/data/define";
import type { CollectionDefinition } from "@tier0/sdk-v2/data/define";
import { seedTimestamp } from "./seed-utils";

const MES_DIRECTORY = ["混合车间", "批次 MES"];

export const BATCH_STATUSES = ["DRAFT", "RELEASED", "FEEDING", "COMPLETED", "VOIDED"] as const;
export const BATCH_EVENT_ACTIONS = ["CREATE", "EDIT", "RELEASE", "FEED", "COMPLETE", "VOID"] as const;

const recipeStep = z.object({
  seq: z.number().int().min(1),
  materialCode: z.string(),
  materialName: z.string(),
  /** Planned quantity for one `baseOutputKg` of product. */
  qtyKg: z.number().min(0),
  tolerancePct: z.number().min(0).max(50),
});

export const recipes = defineCollection({
  alias: "mes_recipes",
  name: "配方",
  directoryPath: MES_DIRECTORY,
  description: "批次配料配方：投料步骤、目标量与允差",
  schema: z.object({
    code: z.string(),
    name: z.string(),
    productName: z.string(),
    version: z.string(),
    baseOutputKg: z.number().min(1),
    active: z.boolean(),
    steps: z.array(recipeStep),
    notes: z.string().optional(),
  }),
  indexes: [{ path: "code", unique: true }, { path: "active" }],
  seed: [
    {
      _id: "rcp-adh-01",
      code: "RCP-ADH-01",
      name: "结构胶 A 配料",
      productName: "结构胶 A",
      version: "v3.2",
      baseOutputKg: 200,
      active: true,
      steps: [
        { seq: 1, materialCode: "RM-RESIN-01", materialName: "环氧树脂", qtyKg: 120, tolerancePct: 2 },
        { seq: 2, materialCode: "RM-HARD-02", materialName: "固化剂", qtyKg: 36, tolerancePct: 1.5 },
        { seq: 3, materialCode: "RM-FILL-07", materialName: "填料", qtyKg: 48, tolerancePct: 3 },
      ],
    },
    {
      _id: "rcp-cot-02",
      code: "RCP-COT-02",
      name: "防护涂料 B 配料",
      productName: "防护涂料 B",
      version: "v1.8",
      baseOutputKg: 250,
      active: true,
      steps: [
        { seq: 1, materialCode: "RM-BASE-11", materialName: "基料", qtyKg: 200, tolerancePct: 2 },
        { seq: 2, materialCode: "RM-SOL-03", materialName: "溶剂", qtyKg: 55, tolerancePct: 2 },
        { seq: 3, materialCode: "RM-PIG-09", materialName: "颜料浆", qtyKg: 18, tolerancePct: 4 },
      ],
    },
    {
      _id: "rcp-sel-03",
      code: "RCP-SEL-03",
      name: "密封胶 C 配料",
      productName: "密封胶 C",
      version: "v2.0",
      baseOutputKg: 100,
      active: false,
      steps: [
        { seq: 1, materialCode: "RM-POLY-04", materialName: "聚合物", qtyKg: 80, tolerancePct: 2 },
        { seq: 2, materialCode: "RM-OIL-05", materialName: "增塑油", qtyKg: 22, tolerancePct: 2 },
      ],
      notes: "等待新版增塑油供应商认证，暂停排产",
    },
  ],
});
export type Recipe = Doc<typeof recipes>;

const feedEntry = z.object({
  qtyKg: z.number().min(0),
  at: z.string(),
  by: z.string(),
});

const batchStep = z.object({
  seq: z.number().int().min(1),
  materialCode: z.string(),
  materialName: z.string(),
  plannedKg: z.number().min(0),
  tolerancePct: z.number().min(0).max(50),
  fedKg: z.number().min(0),
  feeds: z.array(feedEntry),
});

const batchEvent = z.object({
  at: z.string(),
  by: z.string(),
  action: z.enum(BATCH_EVENT_ACTIONS),
  note: z.string().optional(),
});

export const batches = defineCollection({
  alias: "mes_batches",
  name: "生产批次",
  directoryPath: MES_DIRECTORY,
  description: "按配方下达的生产批次，含投料步骤快照、投料记录与操作留痕",
  schema: z.object({
    code: z.string(),
    status: z.enum(BATCH_STATUSES),
    recipe: z.object({ id: z.string(), code: z.string(), name: z.string(), version: z.string() }),
    productName: z.string(),
    reactor: z.string(),
    targetOutputKg: z.number().min(1),
    plannedStartAt: z.string(),
    steps: z.array(batchStep),
    releasedAt: z.string().optional(),
    completedAt: z.string().optional(),
    actualOutputKg: z.number().min(0).optional(),
    voidedAt: z.string().optional(),
    voidReason: z.string().optional(),
    history: z.array(batchEvent),
  }),
  indexes: [{ path: "code", unique: true }, { path: "status" }, { path: "plannedStartAt" }],
  seed: [
    {
      _id: "bat-2026-014",
      code: "BAT-2026-014",
      status: "DRAFT",
      recipe: { id: "rcp-adh-01", code: "RCP-ADH-01", name: "结构胶 A 配料", version: "v3.2" },
      productName: "结构胶 A",
      reactor: "R-201",
      targetOutputKg: 180,
      plannedStartAt: seedTimestamp(1, 1),
      steps: [
        { seq: 1, materialCode: "RM-RESIN-01", materialName: "环氧树脂", plannedKg: 108, tolerancePct: 2, fedKg: 0, feeds: [] },
        { seq: 2, materialCode: "RM-HARD-02", materialName: "固化剂", plannedKg: 32.4, tolerancePct: 1.5, fedKg: 0, feeds: [] },
        { seq: 3, materialCode: "RM-FILL-07", materialName: "填料", plannedKg: 43.2, tolerancePct: 3, fedKg: 0, feeds: [] },
      ],
      history: [{ at: seedTimestamp(0, 2), by: "林计划", action: "CREATE" }],
    },
    {
      _id: "bat-2026-013",
      code: "BAT-2026-013",
      status: "RELEASED",
      recipe: { id: "rcp-cot-02", code: "RCP-COT-02", name: "防护涂料 B 配料", version: "v1.8" },
      productName: "防护涂料 B",
      reactor: "R-203",
      targetOutputKg: 250,
      plannedStartAt: seedTimestamp(0, 6),
      releasedAt: seedTimestamp(0, 3),
      steps: [
        { seq: 1, materialCode: "RM-BASE-11", materialName: "基料", plannedKg: 200, tolerancePct: 2, fedKg: 0, feeds: [] },
        { seq: 2, materialCode: "RM-SOL-03", materialName: "溶剂", plannedKg: 55, tolerancePct: 2, fedKg: 0, feeds: [] },
        { seq: 3, materialCode: "RM-PIG-09", materialName: "颜料浆", plannedKg: 18, tolerancePct: 4, fedKg: 0, feeds: [] },
      ],
      history: [
        { at: seedTimestamp(-1, 8), by: "林计划", action: "CREATE" },
        { at: seedTimestamp(0, 3), by: "林计划", action: "RELEASE" },
      ],
    },
    {
      _id: "bat-2026-012",
      code: "BAT-2026-012",
      status: "FEEDING",
      recipe: { id: "rcp-adh-01", code: "RCP-ADH-01", name: "结构胶 A 配料", version: "v3.2" },
      productName: "结构胶 A",
      reactor: "R-202",
      targetOutputKg: 200,
      plannedStartAt: seedTimestamp(0, 1),
      releasedAt: seedTimestamp(-1, 9),
      steps: [
        {
          seq: 1, materialCode: "RM-RESIN-01", materialName: "环氧树脂", plannedKg: 120, tolerancePct: 2, fedKg: 119.5,
          feeds: [{ qtyKg: 119.5, at: seedTimestamp(0, 1), by: "王操作" }],
        },
        {
          seq: 2, materialCode: "RM-HARD-02", materialName: "固化剂", plannedKg: 36, tolerancePct: 1.5, fedKg: 20,
          feeds: [{ qtyKg: 20, at: seedTimestamp(0, 2), by: "王操作" }],
        },
        { seq: 3, materialCode: "RM-FILL-07", materialName: "填料", plannedKg: 48, tolerancePct: 3, fedKg: 0, feeds: [] },
      ],
      history: [
        { at: seedTimestamp(-2, 7), by: "林计划", action: "CREATE" },
        { at: seedTimestamp(-1, 9), by: "林计划", action: "RELEASE" },
        { at: seedTimestamp(0, 1), by: "王操作", action: "FEED", note: "步骤 1 环氧树脂 119.5 kg" },
        { at: seedTimestamp(0, 2), by: "王操作", action: "FEED", note: "步骤 2 固化剂 20 kg" },
      ],
    },
    {
      _id: "bat-2026-011",
      code: "BAT-2026-011",
      status: "COMPLETED",
      recipe: { id: "rcp-cot-02", code: "RCP-COT-02", name: "防护涂料 B 配料", version: "v1.8" },
      productName: "防护涂料 B",
      reactor: "R-201",
      targetOutputKg: 240,
      plannedStartAt: seedTimestamp(-2, 1),
      releasedAt: seedTimestamp(-3, 9),
      completedAt: seedTimestamp(-2, 8),
      actualOutputKg: 236.4,
      steps: [
        {
          seq: 1, materialCode: "RM-BASE-11", materialName: "基料", plannedKg: 192, tolerancePct: 2, fedKg: 192,
          feeds: [{ qtyKg: 192, at: seedTimestamp(-2, 2), by: "赵工位" }],
        },
        {
          seq: 2, materialCode: "RM-SOL-03", materialName: "溶剂", plannedKg: 52.8, tolerancePct: 2, fedKg: 52.6,
          feeds: [{ qtyKg: 52.6, at: seedTimestamp(-2, 3), by: "赵工位" }],
        },
        {
          seq: 3, materialCode: "RM-PIG-09", materialName: "颜料浆", plannedKg: 17.3, tolerancePct: 4, fedKg: 17.5,
          feeds: [{ qtyKg: 17.5, at: seedTimestamp(-2, 4), by: "赵工位" }],
        },
      ],
      history: [
        { at: seedTimestamp(-4, 7), by: "林计划", action: "CREATE" },
        { at: seedTimestamp(-3, 9), by: "林计划", action: "RELEASE" },
        { at: seedTimestamp(-2, 2), by: "赵工位", action: "FEED", note: "步骤 1 基料 192 kg" },
        { at: seedTimestamp(-2, 3), by: "赵工位", action: "FEED", note: "步骤 2 溶剂 52.6 kg" },
        { at: seedTimestamp(-2, 4), by: "赵工位", action: "FEED", note: "步骤 3 颜料浆 17.5 kg" },
        { at: seedTimestamp(-2, 8), by: "赵工位", action: "COMPLETE", note: "实际产出 236.4 kg" },
      ],
    },
    {
      _id: "bat-2026-010",
      code: "BAT-2026-010",
      status: "VOIDED",
      recipe: { id: "rcp-sel-03", code: "RCP-SEL-03", name: "密封胶 C 配料", version: "v2.0" },
      productName: "密封胶 C",
      reactor: "R-202",
      targetOutputKg: 100,
      plannedStartAt: seedTimestamp(-3, 1),
      voidedAt: seedTimestamp(-4, 6),
      voidReason: "增塑油批次待检，计划取消",
      steps: [
        { seq: 1, materialCode: "RM-POLY-04", materialName: "聚合物", plannedKg: 80, tolerancePct: 2, fedKg: 0, feeds: [] },
        { seq: 2, materialCode: "RM-OIL-05", materialName: "增塑油", plannedKg: 22, tolerancePct: 2, fedKg: 0, feeds: [] },
      ],
      history: [
        { at: seedTimestamp(-5, 7), by: "林计划", action: "CREATE" },
        { at: seedTimestamp(-4, 6), by: "林计划", action: "VOID", note: "增塑油批次待检，计划取消" },
      ],
    },
  ],
});
export type Batch = Doc<typeof batches>;
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export type BatchStep = Batch["steps"][number];

export const counters = defineCollection({
  alias: "mes_counters",
  name: "MES 编号计数器",
  directoryPath: MES_DIRECTORY,
  description: "批次编号等业务序列号",
  schema: z.object({ value: z.number().int().min(0) }),
  seed: [{ _id: "batch-2026", value: 14 }],
});

export const collections = [recipes, batches, counters] as const satisfies readonly CollectionDefinition[];
