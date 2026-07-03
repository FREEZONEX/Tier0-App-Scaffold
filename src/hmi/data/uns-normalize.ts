import type { RawHistoryItem } from "./uns-history";

/** UNS 命名空间节点（归一化后，全部可序列化穿 server fn 边界）。 */
export interface UnsTopic {
  path: string;
  name: string;
  displayName?: string;
  type?: string;
  topicType?: string;
  hasChildren: boolean;
  fields?: UnsSchemaField[];
}

/** topic schema 字段。 */
export interface UnsSchemaField {
  name: string;
  type: string;
  unit?: string;
}

/** OpenapiNodeInfo 的最小结构（只取归一化要用的字段）。 */
interface RawNode {
  name?: string;
  path?: string;
  type?: string;
  topicType?: string;
  displayName?: string;
  children?: RawNode[];
  fields?: UnsSchemaField[];
}

/** unsApi 返回是 any：HttpClient 可能已解包，也可能是 {data:X}。统一取里层。 */
export function pickData(resp: unknown): unknown {
  if (resp && typeof resp === "object" && "data" in resp) return (resp as { data: unknown }).data;
  return resp ?? undefined;
}


/**
 * 判定一个 UNS 节点是「叶子」（可选中的 topic/指标）还是「分支」（命名空间文件夹，只可展开）。
 * 关键：懒加载（maxDepth:1）下分支节点的 children 往往没返回，绝不能用 children 长度判分支/叶子，
 * 否则下层文件夹会被误判成叶子、点了直接 onPick 选中（用户反馈 2 的根因）。
 * 真值来自节点自身的类型标记，且 **topicType 优先于 type**：
 *   - test.tier0.dev（2026-07-03 实测）：文件夹和指标的 type 都是 "PATH"，唯一区分是
 *     topicType——文件夹为空、指标非空（如 "METRIC"）。按 type 判会全员误判成叶子。
 *   - 旧形状（pre.tier0.dev）：type "folder"/"topic" 直接可判。
 * 兜底：类型全缺时，有 fields 视为叶子；已加载到 children → 分支；否则当叶子可选（避免死分支无法选）。
 */
export function isLeafNode(n: Pick<RawNode, "type" | "topicType" | "fields" | "children">): boolean {
  if (n.topicType) return true; // topicType 非空（"json"/"METRIC"）→ 叶子（对 PATH 形状是唯一可靠标记，最先判）
  const type = n.type?.toLowerCase();
  if (type === "topic" || type === "metric") return true; // 明确是 topic/指标 → 叶子
  if (type === "folder" || type === "path") return false; // 文件夹/命名空间 → 分支
  if (n.fields?.length) return true; // 带 schema 字段 → 叶子
  if (n.children?.length) return false; // 已加载到子节点 → 分支
  return true; // 类型未知且无子节点：当叶子可选，避免无法选中的死分支
}

const toTopic = (n: RawNode): UnsTopic => ({
  path: n.path ?? "",
  name: n.name ?? n.path ?? "",
  displayName: n.displayName,
  type: n.type,
  topicType: n.topicType,
  hasChildren: !isLeafNode(n),
  fields: n.fields,
});

/**
 * browse(path) 响应 → 查询点的**直接子层**列表（树的下一层由再次展开懒加载）。
 *
 * 真实 API 形状（2026-06-12 对 pre.tier0.dev 实测）：带 path 的 browse 响应 tree 根
 * 就是查询节点 P 自身（max_depth 含查询点：=1 只回 P、=2 才带其孩子）。
 * 早前实现把树整棵 DFS 平铺，P 自己进了 childrenOf[P] → 渲染 walk 无限递归爆栈
 * （Maximum call stack size exceeded）。本函数保证返回值**绝不含查询点自身**。
 */
export function browseChildrenOf(resp: unknown, path: string): UnsTopic[] {
  const data = pickData(resp) as { tree?: RawNode[] } | undefined;
  const tree = data?.tree ?? [];
  if (path) {
    // 标准形状：树根=查询点，孩子在其 children 下（max_depth≥2 实测如此）。
    // 防御形状：API 把查询点与孩子平铺同层，或只回 [查询点自身]（max_depth=1）。
    // 统一规则：self 有 children 用之；否则取「除自身外的其余节点」——
    // 既滤掉混入的查询点自身（爆栈根因），又在 max_depth=1 只回自身时正确得空。
    const self = tree.find((n) => n.path === path);
    const children = self?.children?.length ? self.children : tree.filter((n) => n.path !== path);
    return children.filter((n) => n.path).map(toTopic);
  }
  return tree.filter((n) => n.path).map(toTopic);
}

/** search 响应 → { items, total, page, size }。 */
export function searchToTopics(resp: unknown): { items: UnsTopic[]; total: number; page: number; size: number } {
  const data = pickData(resp) as { objects?: RawNode[]; total?: number; page?: number; size?: number } | undefined;
  return {
    items: (data?.objects ?? []).filter((n) => n.path).map(toTopic),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    size: data?.size ?? 0,
  };
}

interface RawReadItem {
  topic?: string;
  success?: boolean;
  result?: { value?: unknown };
}

/** read 响应 → 各 topic 的当前值（JSON 串，供首帧喂进 tag-store）。无值/失败的项跳过。 */
export function readToValues(resp: unknown): { topic: string; valueJson: string }[] {
  const data = pickData(resp) as { results?: RawReadItem[] } | undefined;
  const out: { topic: string; valueJson: string }[] = [];
  for (const it of data?.results ?? []) {
    if (it.topic && it.success !== false && it.result?.value !== undefined) {
      out.push({ topic: it.topic, valueJson: JSON.stringify(it.result.value) });
    }
  }
  return out;
}

/** history 响应 → { items, total }（解包 data 信封；缺失安全空）。 */
export function historyResults(resp: unknown): { items: RawHistoryItem[]; total: number } {
  const data = pickData(resp) as { results?: RawHistoryItem[]; total?: number } | undefined;
  return { items: data?.results ?? [], total: data?.total ?? 0 };
}
