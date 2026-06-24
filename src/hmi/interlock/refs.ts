import type { Mimic } from "../schema/schema";
import { translate, getCanvasLang } from "../i18n/translate";

/** 组态期引用完整性检查：返回引用了不存在节点的警告列表（不阻断解析）。 */
export function validateInterlockRefs(mimic: Mimic): string[] {
  const ids = new Set(mimic.nodes.map((n) => n.id));
  const lang = getCanvasLang(); // 警告直接 join 进 HmiPage 横幅（不再 t()），故此处就翻译好（与 validateMimicAssets 一致）
  const warns: string[] = [];
  for (const rule of mimic.interlocks) {
    const conds = Array.isArray(rule.when) ? rule.when : [rule.when];
    conds.forEach((c, i) => {
      if (!ids.has(c.node)) warns.push(translate('联锁 {rule}.when[{i}] 引用的节点 "{node}" 不存在', lang, { rule: rule.id, i, node: c.node }));
    });
    rule.then.forEach((t, i) => {
      if (!ids.has(t.node)) warns.push(translate('联锁 {rule}.then[{i}] 引用的节点 "{node}" 不存在', lang, { rule: rule.id, i, node: t.node }));
    });
  }
  return warns;
}
