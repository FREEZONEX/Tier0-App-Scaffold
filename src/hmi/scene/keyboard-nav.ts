import type { MimicNode } from "../schema/schema";
import type { NodeState } from "./scene";
import { translate, getCanvasLang } from "../i18n/translate";

/**
 * 键盘在节点间循环移动选择。dir=1 下一个、-1 上一个。
 * 未选中时：next→第一个、prev→最后一个。空场景返回 null。
 */
export function stepSelection(nodes: readonly MimicNode[], currentId: string | null, dir: 1 | -1): string | null {
  if (nodes.length === 0) return null;
  const idx = currentId === null ? -1 : nodes.findIndex((n) => n.id === currentId);
  if (idx === -1) return dir === 1 ? nodes[0].id : nodes[nodes.length - 1].id;
  const next = (idx + dir + nodes.length) % nodes.length;
  return nodes[next].id;
}

/** 选中设备的无障碍播报文本：名称 + 关键状态（异常优先）。 */
export function describeSelection(node: MimicNode | null, state: NodeState | null): string {
  const lang = getCanvasLang();
  if (!node || !state) return translate("未选中设备", lang);
  const name = node.label ?? node.id;
  const flags: string[] = [];
  if (state.fault) flags.push(translate("故障", lang));
  if (state.stale) flags.push(translate("失联", lang));
  if (!state.fault && !state.stale) flags.push(translate(state.running ? "运行" : "停止", lang));
  return translate("已选中 {name}，{flags}", lang, { name, flags: flags.join(lang === "en" ? ", " : "、") });
}
