import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";
import { toBool } from "../shared/coerce";
import { translate, getCanvasLang } from "../i18n/translate";

/** 布尔字段按 key 的中文「真/假」标签。 */
const BOOL_LABEL: Record<string, readonly [string, string]> = {
  running: ["运行", "停止"],
  open: ["开", "关"],
  closed: ["闭合", "断开"],
  on: ["通", "断"],
  interlock: ["联锁", "解锁"],
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 把单个 inline 字段值格式化为展示字符串（中文状态 / 数值[+单位] / 占位）。
 * 单位不内置推断（温度无从判断 ℃/℉）——仅当调用方传入 `unit`（来自 binding.unit）才追加。
 * 健壮处理脏数据：布尔语义 key 接受 bool/数字/字符串；非有限数 / 对象 / 空串 → "--"。
 */
export function formatInlineValue(key: string, value: unknown, unit?: string): string {
  if (value === undefined || value === null) return "--";
  const label = BOOL_LABEL[key];
  if (label) {
    return translate(toBool(value) ? label[0] : label[1], getCanvasLang());
  }
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "string" && value.trim() === "") return "--";
  const num = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (Number.isFinite(num)) {
    return unit ? `${round1(num)} ${unit}` : String(round1(num));
  }
  return "--";
}

/** 拼接节点配置的 inline 字段为一行展示文本（· 分隔）。单位取 state.units。空配置返回空串。 */
export function inlineLine(node: MimicNode, state: NodeState): string {
  if (!node.inline || node.inline.length === 0) return "";
  return node.inline
    .map((key) => formatInlineValue(key, state.values[key], state.units?.[key]))
    .join(" · ");
}
