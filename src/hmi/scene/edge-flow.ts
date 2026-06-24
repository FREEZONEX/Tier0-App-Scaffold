import type { MimicEdge } from "../schema/schema";
import { resolveBinding } from "../data/binding";

/** 边是否有流：flowBy 绑定解析为正数（或真值布尔/字符串）即视为流动。 */
export function resolveEdgeFlow(
  edge: MimicEdge,
  getPayload: (topic: string) => unknown,
): boolean {
  if (!edge.flowBy) return false;
  const v = resolveBinding(getPayload, edge.flowBy);
  if (typeof v === "number") return v > 0;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["1", "true", "on", "yes"].includes(v.toLowerCase()) || Number(v) > 0;
  return false;
}
