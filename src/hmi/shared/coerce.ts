/**
 * 系统边界的统一强制转换。所有图元/场景/联锁共用此单一真相源，
 * 避免各处复制的 toBool 真值串白名单不一致（同一字符串在不同模块判定相反）。
 */

/** 真值字符串白名单（小写比较）。 */
const TRUTHY = new Set(["1", "true", "on", "yes", "open", "run", "running", "active"]);

/** 把任意值真值化：bool 原样，number 非 0，string 命中白名单，其余 false。 */
export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return TRUTHY.has(value.trim().toLowerCase());
  return false;
}

/** 解析为有限数；非有限（NaN/Infinity/对象/空串）返回 fallback。 */
export function toFiniteNumber(value: unknown, fallback = NaN): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** 钳到 0..100 的百分比；非数 → 0（液位/仪表填充用）。 */
export function clampPct(value: unknown): number {
  const n = toFiniteNumber(value, NaN);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
