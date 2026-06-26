/**
 * UNS 历史数据的纯归一化与查询助手（无副作用、可单测）。
 * 数据来自 `unsApi.openapiv1unshistory`：趋势走聚合查询、表格走原始分页。
 * SDK 返回类型为 any，故此处全部防御式解析（value 可能是标量或对象、字段可缺）。
 */

// ───────────── 原始响应最小结构（穿过 server fn 边界后的形态） ─────────────

export interface RawHistoryValue {
  timeStamp: number;
  value?: unknown;
  quality?: string;
}

export interface RawHistoryItem {
  topic: string;
  success: boolean;
  error?: { code: number; message: string };
  result?: { values?: RawHistoryValue[] };
}

// ───────────── 边界安全形态（server fn 不允许 unknown 字段，故 value 走 JSON 串） ─────────────

export interface SerialHistorySample {
  timeStamp: number;
  quality: string;
  valueJson: string;
}

export interface SerialHistoryItem {
  topic: string;
  success: boolean;
  error?: { code: number; message: string };
  values: SerialHistorySample[];
}

// ───────────── 归一化产物 ─────────────

/** 趋势单点：t=毫秒时间戳，v=数值。 */
export interface TrendPoint {
  t: number;
  v: number;
}

/** 表格单行：整条原始负载 + 时间 + 质量。 */
export interface HistoryRow {
  t: number;
  quality: string;
  payload: unknown;
}

// ───────────── 常量 ─────────────

/** 趋势单图数据点上限（聚合间隔据此自动选取）。 */
export const MAX_TREND_POINTS = 1000;
/** 趋势跨 topic×字段的系列总上限（超出限幅并明示，不静默截断）。 */
export const MAX_TREND_SERIES = 8;
/** 表格分页大小（每页 10 条）。 */
export const TABLE_PAGE_SIZE = 10;

/**
 * 表格总页数：total 覆盖「已见数据」((page-1)*size+rowsLen) 时按 total 取整页数；
 * total 缺失/偏小（不可信）时兜底——当前页拿满 size 条则至少还有下一页，未拿满则当前页即末页。
 */
export function tablePageCount(total: number, rowsLen: number, page: number, size = TABLE_PAGE_SIZE): number {
  const seen = (page - 1) * size + rowsLen;
  const totalReliable = total > 0 && total >= seen;
  const count = totalReliable ? Math.ceil(total / size) : rowsLen >= size ? page + 1 : page;
  return Math.max(1, count);
}

/** 趋势聚合函数：固定平均（用户决策：不提供选项）。 */
export const TREND_AGG_FN = "avg";

export interface RangePreset {
  value: string;
  label: string;
  ms: number;
}
/** 时间范围预设（label 为 zh-as-key；短文案与起止时间同行展示）。 */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { value: "1h", label: "1 小时", ms: 3_600_000 },
  { value: "6h", label: "6 小时", ms: 6 * 3_600_000 },
  { value: "24h", label: "24 小时", ms: 24 * 3_600_000 },
  { value: "7d", label: "7 天", ms: 7 * 86_400_000 },
];

export interface NiceInterval {
  ms: number;
  label: string;
}
/** 「整间隔」候选（升序）：聚合间隔从中选取，保证点数 ≤ MAX_TREND_POINTS。 */
export const NICE_INTERVALS: readonly NiceInterval[] = [
  { ms: 1_000, label: "1s" },
  { ms: 5_000, label: "5s" },
  { ms: 10_000, label: "10s" },
  { ms: 15_000, label: "15s" },
  { ms: 30_000, label: "30s" },
  { ms: 60_000, label: "1m" },
  { ms: 300_000, label: "5m" },
  { ms: 600_000, label: "10m" },
  { ms: 900_000, label: "15m" },
  { ms: 1_800_000, label: "30m" },
  { ms: 3_600_000, label: "1h" },
  { ms: 7_200_000, label: "2h" },
  { ms: 21_600_000, label: "6h" },
  { ms: 43_200_000, label: "12h" },
  { ms: 86_400_000, label: "1d" },
  { ms: 604_800_000, label: "7d" },
];

// ───────────── 取值 ─────────────

/** 点分路径深取；空路径返回原值；遇非对象/缺键返回 undefined。 */
export function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let cur: unknown = value;
  for (const key of path.split(".")) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** 单元格渲染：空值占位「--」，对象/数组 → 紧凑 JSON，其余 String()。 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "--";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * 从一个历史值里取目标字段的数值：
 * - 标量负载（聚合常回标量）直接用；
 * - 对象负载取 value[field]（聚合结果常按字段名键控）；
 * - 取不到数值 → NaN（调用方过滤）。
 */
function extractNumeric(value: unknown, field: string): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const direct = valueAtPath(value, field);
    if (typeof direct === "number") return direct;
  }
  return NaN;
}

// ───────────── 归一化 ─────────────

/** 单 topic 单字段聚合结果 → 时间升序的趋势点（剔除非数值点）。 */
export function historyToTrend(item: RawHistoryItem, field: string): TrendPoint[] {
  if (!item.success || !item.result?.values) return [];
  const pts: TrendPoint[] = [];
  for (const val of item.result.values) {
    const v = extractNumeric(val.value, field);
    if (Number.isFinite(v)) pts.push({ t: val.timeStamp, v });
  }
  return pts.sort((a, b) => a.t - b.t);
}

/** 单 topic 原始结果 → 整条负载行，时间倒序（新→旧）。 */
export function historyToRows(item: RawHistoryItem): HistoryRow[] {
  if (!item.success || !item.result?.values) return [];
  return item.result.values
    .map((v) => ({ t: v.timeStamp, quality: v.quality ?? "", payload: v.value }))
    .sort((a, b) => b.t - a.t);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** 行集合 → 动态列（对象负载顶层 key 并集，首见顺序；全标量 → []）。 */
export function tableColumns(rows: readonly HistoryRow[]): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (isPlainObject(r.payload)) {
      for (const k of Object.keys(r.payload)) {
        if (!seen.has(k)) {
          seen.add(k);
          cols.push(k);
        }
      }
    }
  }
  return cols;
}

// ───────────── 聚合间隔策略（点数 ≤ 上限） ─────────────

/** 选满足 `ceil(rangeMs/interval) ≤ maxPoints` 的最小整间隔；极大范围回退最大间隔。 */
export function chooseTrendInterval(
  rangeMs: number,
  maxPoints = MAX_TREND_POINTS,
): { interval: string; approxPoints: number } {
  for (const iv of NICE_INTERVALS) {
    const points = Math.ceil(rangeMs / iv.ms);
    if (points <= maxPoints) return { interval: iv.label, approxPoints: points };
  }
  const last = NICE_INTERVALS[NICE_INTERVALS.length - 1];
  return { interval: last.label, approxPoints: Math.ceil(rangeMs / last.ms) };
}

// ───────────── 交互助手（hover / 框选） ─────────────

/** x 占比 → 最近桶索引并钳制；无点返回 -1。 */
export function nearestPointIndex(pointCount: number, xRatio: number): number {
  if (pointCount <= 0) return -1;
  if (pointCount === 1) return 0;
  const idx = Math.round(xRatio * (pointCount - 1));
  return Math.max(0, Math.min(pointCount - 1, idx));
}

/** 框选两端占比 → 绝对时间子区间（自动正序、越界钳制）；过窄返回 null（防误触）。 */
export function brushToRange(
  x0: number,
  x1: number,
  startMs: number,
  endMs: number,
  minRatio = 0.02,
): { startMs: number; endMs: number } | null {
  const lo = Math.max(0, Math.min(x0, x1));
  const hi = Math.min(1, Math.max(x0, x1));
  if (hi - lo < minRatio) return null;
  const span = endMs - startMs;
  return { startMs: Math.round(startMs + lo * span), endMs: Math.round(startMs + hi * span) };
}

/** 系列图例名：单 topic 用字段名，多 topic 加 topic 短名（末段）前缀。 */
export function seriesLabel(topic: string, field: string, multiTopic: boolean): string {
  if (!multiTopic) return field;
  const short = topic.split("/").filter(Boolean).pop() ?? topic;
  return `${short}·${field}`;
}

// ───────────── 多系列时间对齐（趋势绘制 / hover 共用一套 x 轴） ─────────────

export interface NamedSeries {
  name: string;
  points: readonly TrendPoint[];
}

export interface AlignedSeries {
  /** 全系列时间并集（升序），即统一 x 轴桶。 */
  times: number[];
  /** 每系列在统一桶上的值，缺口为 null。 */
  columns: { name: string; values: (number | null)[] }[];
}

/** 把若干系列按时间并集对齐到同一 x 轴（缺口填 null），使多系列绘制与 hover 索引一致。 */
export function alignSeries(list: readonly NamedSeries[]): AlignedSeries {
  const timeSet = new Set<number>();
  for (const s of list) for (const p of s.points) timeSet.add(p.t);
  const times = [...timeSet].sort((a, b) => a - b);
  const index = new Map(times.map((t, i) => [t, i] as const));
  const columns = list.map((s) => {
    const values: (number | null)[] = times.map(() => null);
    for (const p of s.points) {
      const i = index.get(p.t);
      if (i !== undefined) values[i] = p.v;
    }
    return { name: s.name, values };
  });
  return { times, columns };
}

// ───────────── 跨边界序列化 / 解析 ─────────────

/** 原始历史项 → 边界安全形态（value 转 JSON 串；空值落为 "null" 而非丢成 undefined）。 */
export function serializeHistory(items: readonly RawHistoryItem[]): SerialHistoryItem[] {
  return items.map((it) => ({
    topic: it.topic,
    success: it.success,
    error: it.error,
    values: (it.result?.values ?? []).map((v) => ({
      timeStamp: v.timeStamp,
      quality: v.quality ?? "",
      valueJson: JSON.stringify(v.value ?? null),
    })),
  }));
}

const parseSampleValue = (valueJson: string): unknown => {
  try {
    return JSON.parse(valueJson);
  } catch {
    return valueJson;
  }
};

/** 边界形态 → 原始历史项（解析 valueJson 回负载），供纯归一化函数消费。 */
export function parseHistory(items: readonly SerialHistoryItem[]): RawHistoryItem[] {
  return items.map((it) => ({
    topic: it.topic,
    success: it.success,
    error: it.error,
    result: {
      values: it.values.map((v) => ({
        timeStamp: v.timeStamp,
        quality: v.quality,
        value: parseSampleValue(v.valueJson),
      })),
    },
  }));
}
