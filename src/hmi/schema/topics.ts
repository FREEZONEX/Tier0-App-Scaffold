import type { Mimic } from "./schema";

/** 收集 schema 中所有唯一 topic（节点 topics + 绑定 topic + 边 flowBy）。 */
export function schemaTopics(mimic: Mimic): string[] {
  const set = new Set<string>();
  for (const node of mimic.nodes) {
    for (const t of node.topics) set.add(t);
    for (const b of Object.values(node.bindings)) set.add(b.topic);
    for (const w of node.watches ?? []) set.add(w.topic);
  }
  for (const edge of mimic.edges) {
    if (edge.flowBy) set.add(edge.flowBy.topic);
  }
  return [...set];
}
