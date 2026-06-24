import type { InterlockRule, InterlockCond } from "../schema/schema";

function condsOf(rule: InterlockRule): readonly InterlockCond[] {
  return Array.isArray(rule.when) ? rule.when : [rule.when];
}

function hasChain(rule: InterlockRule): boolean {
  return condsOf(rule).some((c) => c.chainOn);
}

/** 链式规则的节点依赖图中检测环（组态期诊断用）。 */
function detectCycles(chainRules: readonly InterlockRule[]): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const rule of chainRules) {
    for (const c of condsOf(rule)) {
      if (!c.chainOn) continue;
      for (const t of rule.then) {
        const set = adj.get(c.node) ?? new Set<string>();
        set.add(t.node);
        adj.set(c.node, set);
      }
    }
  }
  const cycles: string[][] = [];
  const color = new Map<string, number>(); // 1 gray, 2 black
  const stack: string[] = [];
  const dfs = (u: string): void => {
    color.set(u, 1);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === 1) {
        const idx = stack.indexOf(v);
        if (idx >= 0) cycles.push(stack.slice(idx));
      } else if (!color.get(v)) {
        dfs(v);
      }
    }
    stack.pop();
    color.set(u, 2);
  };
  for (const n of adj.keys()) if (!color.get(n)) dfs(n);
  return cycles;
}

/** 静态检测链式联锁规则中的环（供 validate-mimic 组态校验）。 */
export function detectInterlockCycles(rules: readonly InterlockRule[]): string[][] {
  return detectCycles(rules.filter(hasChain));
}
