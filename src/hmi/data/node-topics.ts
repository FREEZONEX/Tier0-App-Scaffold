/**
 * 从图元收集它绑定的去重 topic 列表（历史查看器的 topic 选择器数据源）。
 * 来源：node.topics（订阅）+ bindings[*].topic（驱动外观）+ watches[*].topic（纯显示点）。
 * 纯函数、无副作用，结构化入参便于单测，与完整 MimicNode 结构兼容。
 */

/** 映射字段：path=负载字段（聚合查询用），label=元件字段名/watch 标签（趋势显示用）。 */
export interface NodeTopicField {
  path: string;
  label: string;
}

export interface NodeTopic {
  topic: string;
  /** 显示标签：绑定字段名 / watch label 优先，否则 topic 本身。 */
  label: string;
  /** 映射字段（binding/watch 的 path+元件字段名，按 path 去重）：趋势据此只查映射字段，不查全表。 */
  fields: NodeTopicField[];
}

export interface TopicSource {
  topics?: readonly string[];
  bindings?: Readonly<Record<string, { topic: string; path?: string; [k: string]: unknown }>>;
  watches?: readonly { label: string; topic: string; path?: string; [k: string]: unknown }[];
}

/** 汇总去重 topic（首见顺序），给出显示标签与映射字段路径。 */
export function nodeTopics(node: TopicSource): NodeTopic[] {
  const order: string[] = [];
  const labels = new Map<string, string[]>();
  const fields = new Map<string, NodeTopicField[]>();
  const ensure = (topic: string): boolean => {
    if (!topic) return false;
    if (!labels.has(topic)) {
      labels.set(topic, []);
      fields.set(topic, []);
      order.push(topic);
    }
    return true;
  };
  const pushLabel = (topic: string, v?: string) => {
    if (!v) return;
    const list = labels.get(topic)!;
    if (!list.includes(v)) list.push(v);
  };
  // 映射字段按 path 去重（同一负载字段只画一条，标签取首见）
  const pushField = (topic: string, path?: string, label?: string) => {
    if (!path) return;
    const list = fields.get(topic)!;
    if (!list.some((f) => f.path === path)) list.push({ path, label: label || path });
  };

  for (const t of node.topics ?? []) ensure(t);
  for (const [field, b] of Object.entries(node.bindings ?? {})) {
    if (ensure(b.topic)) {
      pushLabel(b.topic, field);
      pushField(b.topic, b.path, field);
    }
  }
  for (const w of node.watches ?? []) {
    if (ensure(w.topic)) {
      pushLabel(w.topic, w.label);
      pushField(w.topic, w.path, w.label);
    }
  }

  return order.map((topic) => {
    const ls = labels.get(topic) ?? [];
    return { topic, label: ls.length > 0 ? ls.join(", ") : topic, fields: fields.get(topic) ?? [] };
  });
}
