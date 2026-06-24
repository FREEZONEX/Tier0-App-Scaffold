import { z } from "zod";

/** 阈值（过程值越限派生告警）：hihi/lolo→alarm，hi/lo→warn。 */
export const alarmLimitsSchema = z.object({
  hihi: z.number().optional(),
  hi: z.number().optional(),
  lo: z.number().optional(),
  lolo: z.number().optional(),
});
export type AlarmLimits = z.infer<typeof alarmLimitsSchema>;

/** 布尔判定条件：算子(=/≠/>/</≥/≤) + 值。eq/ne 支持逗号多值；> < ≥ ≤ 走数值比较。 */
export const conditionSchema = z.object({ op: z.enum(["eq", "ne", "gt", "lt", "ge", "le"]), value: z.string() });
export type Condition = z.infer<typeof conditionSchema>;

/**
 * 绑定：field → topic/path 取值，可选「映射层」把五花八门的原始值翻译成图元状态。
 * - map：原始值(转字符串作 key) → 目标值(布尔/数值/状态串)；未命中视为「未知」。万能兜底。
 * - test：判为真(开/运行)的条件；testOff：判为假(关/停止)的条件。两者各自独立配置，优先于 map：
 *   命中 test→真、命中 testOff→假；只配其一→其余取补；两者都配且都不命中→未知（不静默猜）。
 * - invert：布尔结果取反（应对反逻辑设备）。
 * - scale：数值原始工程量 [min,max] 线性映射到 0–100。
 * - alarms：在解析后的数值上判阈，派生 warn/alarm 装饰。
 * 都不配时：默认按 shared.toBool/原始值，吃下常规消息。
 */
export const bindingSchema = z.object({
  topic: z.string().min(1),
  path: z.string().min(1),
  map: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])).optional(),
  test: conditionSchema.optional(),
  testOff: conditionSchema.optional(),
  invert: z.boolean().optional(),
  scale: z.object({ min: z.number(), max: z.number() }).optional(),
  alarms: alarmLimitsSchema.optional(),
  /** 显示单位（用户填，不内置推断——温度无从判断 ℃/℉）。仅显示用；量程 scale 仅驱动视觉比例。 */
  unit: z.string().optional(),
});
export type Binding = z.infer<typeof bindingSchema>;

/** 发布模板单条消息：topic + payload JSON 模板字符串。 */
export const publishMessageSchema = z.object({ topic: z.string().min(1), template: z.string() });
export type PublishMessage = z.infer<typeof publishMessageSchema>;

/** 发布模板：命名的消息组（一个模板可一键发往多个 topic）。 */
export interface PublishPreset {
  readonly name: string;
  readonly items: readonly PublishMessage[];
}

/**
 * 兼容旧单条形态 {name?, topic, template}：解析时归一为 {name, items}（无 name 用 topic 兜底）。
 * 新形态 {name, items} 原样通过。两者皆缺 → refine 报错而非静默吞。
 */
const publishPresetSchema = z
  .object({
    name: z.string().optional(),
    topic: z.string().optional(),
    template: z.string().optional(),
    items: z.array(publishMessageSchema).optional(),
  })
  .transform(
    (p): PublishPreset => ({
      name: p.name ?? p.topic ?? "",
      items: p.items ?? (p.topic !== undefined ? [{ topic: p.topic, template: p.template ?? "{}" }] : []),
    }),
  )
  .refine((p) => p.name.length > 0 && p.items.length > 0, { message: "发布模板需有名称与至少一条消息" });

// ───────────── 设备动作（操作→写值，与 bindings 数据→外观严格分离） ─────────────

/**
 * 设备动作：渲染为停靠在设备下方的胶囊按钮。label=按钮文字；items=点击时逐条发布的消息组；
 * confirm=发送前二次确认。列表顺序即优先级：≤3 个全部直达，≥4 个前 2 个直达、其余收进 ⋯ 菜单。
 */
export const deviceActionSchema = z.object({
  label: z.string().min(1),
  items: z.array(publishMessageSchema).min(1),
  confirm: z.boolean().optional(),
});
export type DeviceAction = z.infer<typeof deviceActionSchema>;

/** 单设备动作上限：防按钮/菜单失控（fail-fast）。 */
export const MAX_NODE_ACTIONS = 8;

/**
 * 额外数据点：自定义实时值（label + topic/path），显示在检视面板实时数据区。
 * 可选 alarms（与 binding 同款，判原始值）：越限参与节点告警圈（warn 黄 / alarm 红+fault），
 * 面板里对应值变色，让用户一眼定位告警源。
 */
export const watchSchema = z.object({
  label: z.string().min(1),
  topic: z.string().min(1),
  path: z.string().default(""),
  /** 显示单位（用户填，仅显示用）：贴身读数/检视面板追加，如 ℃ / kPa。 */
  unit: z.string().optional(),
  alarms: alarmLimitsSchema.optional(),
});
export type WatchPoint = z.infer<typeof watchSchema>;

export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  /** 横/纵缩放倍率（绕节点中心，分轴 → 支持等比放大缩小 + 单轴拉伸压扁）。缺省/未配置视为 1。 */
  sizeX: z.number().positive().optional(),
  sizeY: z.number().positive().optional(),
  label: z.string().optional(),
  topics: z.array(z.string()).default([]),
  bindings: z.record(z.string(), bindingSchema).default({}),
  inline: z.array(z.string()).default([]),
  /** 额外数据点：纯显示的自定义实时值（不绑图元状态，只在检视面板实时数据区显示）。缺省视为无。 */
  watches: z.array(watchSchema).optional(),
  /** 图元专属静态配置（如 vessel.agitator、dialgauge.face、exchanger.orientation）。 */
  props: z.record(z.string(), z.unknown()).optional(),
  /** MQTT 发布模板：命名的多条 (topic, payload) 消息组，可一键发往多个 topic。 */
  publishPresets: z.array(publishPresetSchema).optional(),
  /** 设备动作按钮：预览模式点击执行（发 MQTT）。缺省视为无按钮。 */
  actions: z.array(deviceActionSchema).max(MAX_NODE_ACTIONS).optional(),
});
export type MimicNode = z.infer<typeof nodeSchema>;

export const edgeSchema = z
  .object({
    id: z.string().min(1),
    // 端点：节点 id 或自由点，每端恰选一（见下方 superRefine）
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
    fromPoint: z.tuple([z.number(), z.number()]).optional(),
    toPoint: z.tuple([z.number(), z.number()]).optional(),
    points: z.array(z.tuple([z.number(), z.number()])).min(2),
    flowBy: bindingSchema.optional(),
    /** 仪表引线：细虚线连接（仪表→被测设备的测量信号线），不承载流向动画。 */
    lead: z.boolean().optional(),
    /**
     * 画线工具产物标记。注：渲染层已对所有非 lead 边按两端图元实时位置重算正交轨迹
     * （图元移动线自动跟随、不残留旧折点），故 points 对过程管线仅作悬空兜底快照。
     * 此标记保留以区分「拉线生成」与「schema 手填」的边。
     */
    auto: z.boolean().optional(),
    /** 端口方位（用户拉线时的出/入口，L/R/T/B）：auto 走线尊重它；缺省=中心制自动选边。 */
    fromSide: z.enum(["L", "R", "T", "B"]).optional(),
    toSide: z.enum(["L", "R", "T", "B"]).optional(),
  })
  .superRefine((e, ctx) => {
    if (!!e.from === !!e.fromPoint) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "起点须为节点 id 或自由点，恰选其一" });
    }
    if (!!e.to === !!e.toPoint) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "终点须为节点 id 或自由点，恰选其一" });
    }
  });
export type EdgeSide = NonNullable<z.infer<typeof edgeSchema>["fromSide"]>;
export type MimicEdge = z.infer<typeof edgeSchema>;

// ───────────── 联锁/联动规则 ─────────────

/** 条件算子：数值比较 + 真值/故障/失联。 */
export const interlockOpSchema = z.enum([">", "<", ">=", "<=", "==", "!=", "truthy", "falsy", "fault", "stale"]);
export type InterlockOp = z.infer<typeof interlockOpSchema>;

/**
 * 单个条件：读 source 节点 NodeState 某字段。
 * field 特殊值 "fault"/"stale"/"running" 读标志位；其余读 values[field]。
 * chainOn=true 时改读 source 当前是否已被联锁（A→B→C 链）。
 */
export const interlockCondSchema = z
  .object({
    node: z.string().min(1),
    field: z.string().min(1),
    op: interlockOpSchema,
    value: z.union([z.number(), z.string(), z.boolean()]).optional(),
    chainOn: z.boolean().default(false),
  })
  .superRefine((c, ctx) => {
    const opless = c.op === "truthy" || c.op === "falsy" || c.op === "fault" || c.op === "stale" || c.chainOn;
    if (!opless && c.value === undefined) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `算子 "${c.op}" 需要 value` });
    }
  });
export type InterlockCond = z.infer<typeof interlockCondSchema>;

/** 效果类型：lock=闭锁、trip=跳车、inhibit=禁启、forceClose/forceOpen=强制阀位。全部点亮挂锁角标。 */
export const interlockEffectKind = z.enum(["lock", "trip", "inhibit", "forceClose", "forceOpen"]);
export type InterlockEffectKind = z.infer<typeof interlockEffectKind>;

export const interlockTargetSchema = z.object({
  node: z.string().min(1),
  kind: interlockEffectKind.default("lock"),
});
export type InterlockTarget = z.infer<typeof interlockTargetSchema>;

export const interlockRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  when: z.union([interlockCondSchema, z.array(interlockCondSchema).min(1)]),
  combine: z.enum(["all", "any"]).default("all"),
  then: z.array(interlockTargetSchema).min(1),
  onStale: z.enum(["lock", "release"]).default("lock"),
});
export type InterlockRule = z.infer<typeof interlockRuleSchema>;

// 数组上限：防止超大/恶意 schema 拖垮渲染与联锁求值（fail-fast 而非运行期崩）
const MAX_NODES = 2000;
const MAX_EDGES = 5000;
const MAX_INTERLOCKS = 2000;

export const mimicSchema = z
  .object({
    meta: z.object({ name: z.string().min(1), version: z.number().default(1) }),
    broker: z.object({ url: z.string().min(1) }).optional(),
    nodes: z.array(nodeSchema).max(MAX_NODES),
    edges: z.array(edgeSchema).max(MAX_EDGES).default([]),
    interlocks: z.array(interlockRuleSchema).max(MAX_INTERLOCKS).default([]),
  })
  .superRefine((m, ctx) => {
    // 节点 id 必须唯一：重复会让 buildScene 的 byId 静默覆盖，命中/联锁指向不确定节点
    const seen = new Set<string>();
    m.nodes.forEach((n, i) => {
      if (seen.has(n.id)) {
        ctx.addIssue({ code: "custom", path: ["nodes", i, "id"], message: `节点 id "${n.id}" 重复` });
      }
      seen.add(n.id);
    });
  });
export type Mimic = z.infer<typeof mimicSchema>;

export interface ParseResult {
  readonly ok: boolean;
  readonly data?: Mimic;
  readonly error?: string;
}

/**
 * 校验未知输入为 Mimic。失败返回字段级错误信息，绝不抛异常 / 不返回半张图。
 */
export function parseMimic(input: unknown): ParseResult {
  const result = mimicSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join(".");
    return { ok: false, error: `${path || "(root)"}: ${first.message}` };
  }
  return { ok: true, data: result.data };
}
