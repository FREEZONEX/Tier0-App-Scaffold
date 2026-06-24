import type { Binding, AlarmLimits } from "../schema/schema";
import { toFiniteNumber } from "../shared/coerce";

export type SignalLevel = "normal" | "warn" | "alarm";
export type SignalQuality = "good" | "stale" | "unknown";

export interface ResolvedSignal {
  /** 图元使用的值（经 map 后的原始工程值；不再被 scale 归一化）。无数据为 undefined。 */
  readonly value: unknown;
  /** 视觉填充比例 0–100（由 scale 量程算得，仅供罐体填充/仪表角度等视觉用）。无 scale 时省略。 */
  readonly fraction?: number;
  /** 阈值派生等级（normal/warn/alarm）。 */
  readonly level: SignalLevel;
  /** 数据质量：good / stale(无数据) / unknown(配了 map 却没命中)。 */
  readonly quality: SignalQuality;
}

function scaleValue(n: number, scale: { min: number; max: number }): number {
  const span = scale.max - scale.min || 1;
  return ((n - scale.min) / span) * 100;
}

function alarmLevel(value: number, limits: AlarmLimits): SignalLevel {
  if (limits.hihi !== undefined && value >= limits.hihi) return "alarm";
  if (limits.lolo !== undefined && value <= limits.lolo) return "alarm";
  if (limits.hi !== undefined && value >= limits.hi) return "warn";
  if (limits.lo !== undefined && value <= limits.lo) return "warn";
  return "normal";
}

/** 布尔判定条件：满足 op/value → true，否则 false。eq/ne 支持逗号多值；> < ≥ ≤ 走数值比较。 */
function evalTest(raw: unknown, test: { op: string; value: string }): boolean {
  if (test.op === "eq" || test.op === "ne") {
    const vals = test.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const hit = vals.includes(String(raw));
    return test.op === "eq" ? hit : !hit;
  }
  const a = toFiniteNumber(raw, NaN);
  const b = Number(test.value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (test.op === "gt") return a > b;
  if (test.op === "lt") return a < b;
  if (test.op === "ge") return a >= b;
  return a <= b; // le
}

/**
 * 把一条绑定的原始值翻译成图元状态（SaaS 核心：吃下五花八门的设备消息）。
 * 流程：原始值 → map(显式值域映射) → invert(反逻辑) → 数值则 scale(量程归一) + alarms(判阈)。
 * map 已配但原始值不在表内 → quality="unknown"（配错/异常码显式可见，不静默猜）。
 */
export function resolveSignal(binding: Binding, raw: unknown): ResolvedSignal {
  if (raw === undefined || raw === null) return { value: undefined, level: "normal", quality: "stale" };

  let mapped: unknown = raw;
  if (binding.test || binding.testOff) {
    // 开/关各自独立判定，开条件优先。只配其一→其余取补；两者都配且都不命中→未知（不静默猜）。
    if (binding.test && evalTest(raw, binding.test)) mapped = true;
    else if (binding.testOff && evalTest(raw, binding.testOff)) mapped = false;
    else if (!binding.testOff) mapped = false; // 只配开：其余=关
    else if (!binding.test) mapped = true; // 只配关：其余=开
    else return { value: raw, level: "normal", quality: "unknown" }; // 开关都配且都不命中
  } else if (binding.map) {
    const key = String(raw);
    if (Object.prototype.hasOwnProperty.call(binding.map, key)) mapped = binding.map[key];
    else return { value: raw, level: "normal", quality: "unknown" };
  }
  if (binding.invert && typeof mapped === "boolean") mapped = !mapped;

  if (binding.scale || binding.alarms) {
    const n = typeof mapped === "number" ? mapped : toFiniteNumber(mapped, NaN);
    if (Number.isFinite(n)) {
      // value 保留原始工程值；scale 仅算视觉比例 fraction；alarms 判原始值。
      const level = binding.alarms ? alarmLevel(n, binding.alarms) : "normal";
      if (binding.scale) return { value: n, fraction: scaleValue(n, binding.scale), level, quality: "good" };
      return { value: n, level, quality: "good" };
    }
  }
  return { value: mapped, level: "normal", quality: "good" };
}
