import type { UnsTopic } from "./uns-normalize";

export interface UnsTreeRow {
  readonly node: UnsTopic;
  readonly depth: number;
}

/**
 * 按展开态把懒加载 UNS 树扁平化为可见行（DFS，父在前）。
 * visited 环防护：数据层已保证 childrenOf[P] 不含 P 自身（见 browseChildrenOf），
 * 这里再兜一层——即便上游某天回出自环/祖先环，渲染也只截断该支，绝不无限递归爆栈。
 */
export function visibleRows(
  childrenOf: Readonly<Record<string, readonly UnsTopic[]>>,
  expanded: ReadonlySet<string>,
): UnsTreeRow[] {
  const rows: UnsTreeRow[] = [];
  const walk = (parent: string, depth: number, visited: ReadonlySet<string>) => {
    for (const node of childrenOf[parent] ?? []) {
      rows.push({ node, depth });
      if (expanded.has(node.path) && !visited.has(node.path)) {
        walk(node.path, depth + 1, new Set(visited).add(node.path));
      }
    }
  };
  walk("", 0, new Set([""]));
  return rows;
}
