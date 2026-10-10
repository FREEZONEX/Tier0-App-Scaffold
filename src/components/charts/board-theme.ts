/**
 * 车间大屏的配色、尺寸单位与坐标刻度（纯函数）。
 *
 * 设计基准 1920×1080。看板根节点在宽屏时是 size 容器，`--u` = 设计稿 1px 在当前容器里的长度：
 * 大屏 min(100cqw/1920, 100cqh/1080)，工作区 16:9 画框 100cqw/1920，窄屏（手机）固定 0.8px 并纵向堆叠。
 * 尺寸一律写 `u(px)`（布局随容器流式缩放，不用 CSS zoom / transform scale），文字用 `uText(px)` 带最小字号。
 *
 * 配色：控制室暗色，九成灰阶；颜色只给系列标识与异常（延期、不良用 critical 红，并配图标 + 文字）。
 * 系列色取自已验证的暗色分类色板（对 #0f172a 面板：明度带、色度、CVD 相邻 ΔE、对比度均通过）。
 */

export const BOARD = {
  plane: "#0b1120",
  surface: "#0f172a",
  surfaceRaised: "#131d33",
  line: "#1e293b",
  axis: "#334155",
  ink: "#e2e8f0",
  ink2: "#94a3b8",
  ink3: "#64748b",
  accent: "#3b82f6",
  /** 系列：完成工单（柱）/ 工单产出（线）。 */
  seriesBlue: "#3987e5",
  seriesAqua: "#199e70",
  /** 系列：不良品数（柱）/ 不良品率（线）。 */
  seriesMagenta: "#d55181",
  seriesYellow: "#c98500",
  good: "#0ca30c",
  critical: "#f06262",
  warning: "#fab219",
} as const;

/** 设计稿像素 → 当前看板长度。 */
export function u(px: number): string {
  return `calc(var(--u) * ${px})`;
}

/** 文字尺寸：随看板缩放，但不小于 `min` px。 */
export function uText(px: number, min = 11): string {
  return `max(${min}px, calc(var(--u) * ${px}))`;
}

/** 坐标轴「好看」的上限：≥ max，形如 1/2/2.5/5 × 10^n，并能被 `intervals` 等分。 */
export function niceMax(max: number, intervals = 4, integer = false): number {
  if (!(max > 0)) return integer ? intervals : 1;
  const raw = max / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const steps = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = magnitude * 10;
  for (const candidate of steps) {
    if (candidate * magnitude >= raw) {
      step = candidate * magnitude;
      break;
    }
  }
  if (integer) step = Math.max(1, Math.ceil(step));
  return step * intervals;
}

/** 0..max 的等分刻度。 */
export function ticks(max: number, intervals = 4): number[] {
  return Array.from({ length: intervals + 1 }, (_, index) => (max / intervals) * index);
}

/** 刻度文字：去掉浮点尾差。 */
export function tickText(value: number, suffix = ""): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}${suffix}`;
}

/** 顶部圆角（4px 或柱宽一半）、底部方角的柱形路径。 */
export function roundedBarPath(x: number, y: number, width: number, height: number, radius = 4): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

/** 圆环进度弧（从 12 点顺时针）。 */
export function ringDash(radius: number, percent: number): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return { circumference, offset: circumference * (1 - clamped / 100) };
}

/**
 * 工序进度圆环链：工序名字号、每道工序占位宽度（含环间连线）与连线长度（px）。
 * 名称区至少容纳 4.6 个汉字（超长截断并悬停显示全称），窄格内整条链横向滚动。
 */
export function ringSlot(ringSize: number): { nameFont: number; slot: number; connector: number } {
  const nameFont = Math.max(10, Math.round(ringSize * 0.4));
  const connector = Math.round(ringSize * 0.35);
  const nameWidth = Math.max(Math.round(ringSize * 1.6), Math.round(nameFont * 4.6));
  return { nameFont, slot: nameWidth + connector, connector };
}

export const WORK_ORDER_STATUS_STYLE: Record<number, { label: string; color: string }> = {
  0: { label: "未开始", color: "#94a3b8" },
  1: { label: "执行中", color: "#60a5fa" },
};

export const APPROVE_STATUS_STYLE: Record<number, { label: string; color: string }> = {
  0: { label: "未审批", color: "#fab219" },
  1: { label: "已通过", color: "#4ade80" },
  2: { label: "已拒绝", color: "#f06262" },
};
