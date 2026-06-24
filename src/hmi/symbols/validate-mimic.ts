import type { Mimic } from "../schema/schema";
import type { Registry } from "./registry";
import { validateInterlockRefs } from "../interlock/refs";
import { detectInterlockCycles } from "../interlock/engine";
import { bindableKeys, getCapability } from "./capabilities";
import { translate, getCanvasLang } from "../i18n/translate";

/**
 * 组态期非阻断校验：返回人读警告列表（schema 已通过 zod 解析，这里查"能渲染但可能不符预期"的问题）。
 * - 未注册的 node.type（会渲染成占位 "?"）
 * - binding key 不在该类型状态契约内（后配数据绑定时防拼错）
 * - edge.from/to 指向不存在的节点
 * - 联锁规则引用不存在的节点（委托 validateInterlockRefs）
 * 不抛异常、不阻断渲染——模版应尽量渲染已知部分，把问题显式告知使用者。
 */
export function validateMimicAssets(mimic: Mimic, registry: Registry): string[] {
  const warns: string[] = [];
  const ids = new Set(mimic.nodes.map((n) => n.id));
  const lang = getCanvasLang();

  for (const node of mimic.nodes) {
    if (!registry.has(node.type)) {
      warns.push(translate('节点 "{id}" 的 type "{type}" 未注册（将渲染为占位符）', lang, { id: node.id, type: node.type }));
      continue;
    }
    // 已知类型才查绑定键：未在状态契约内的 key 多半是拼错/绑错（后配易踩）
    if (getCapability(node.type)) {
      const allowed = bindableKeys(node.type);
      for (const key of Object.keys(node.bindings)) {
        if (!allowed.has(key)) {
          warns.push(translate('节点 "{id}" 绑定了未知字段 "{key}"（{type} 可绑：{keys}）', lang, { id: node.id, key, type: node.type, keys: [...allowed].join("/") || translate("无", lang) }));
        }
      }
    }
  }
  for (const edge of mimic.edges) {
    if (edge.from && !ids.has(edge.from)) warns.push(translate('连线 "{id}" 的 from "{ref}" 不是已知节点', lang, { id: edge.id, ref: edge.from }));
    if (edge.to && !ids.has(edge.to)) warns.push(translate('连线 "{id}" 的 to "{ref}" 不是已知节点', lang, { id: edge.id, ref: edge.to }));
  }
  warns.push(...validateInterlockRefs(mimic));
  for (const cycle of detectInterlockCycles(mimic.interlocks)) {
    warns.push(translate("联锁链存在环：{chain}", lang, { chain: `${cycle.join(" → ")} → ${cycle[0]}` }));
  }
  return warns;
}
