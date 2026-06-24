import type { Mimic, MimicNode, MimicEdge, Binding, WatchPoint, DeviceAction, EdgeSide } from "./schema";

function mapNode(mimic: Mimic, nodeId: string, fn: (node: MimicNode) => MimicNode): Mimic {
  let changed = false;
  const nodes = mimic.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    changed = true;
    return fn(node);
  });
  return changed ? { ...mimic, nodes } : mimic;
}

/** 不可变设置/清除节点的单个静态 prop（props[key]=value；value 为 undefined/空串则删除该键，空 props 则省字段）。 */
export function setNodeProp(mimic: Mimic, nodeId: string, key: string, value: string | undefined): Mimic {
  const node = mimic.nodes.find((n) => n.id === nodeId);
  if (!node) return mimic;
  const clearing = value === undefined || value === "";
  // no-op 守卫：清除本就不存在的键、或设成与当前相同的值 → 原样返回，不写入空操作历史
  if (clearing ? !(node.props && key in node.props) : node.props?.[key] === value) return mimic;
  return mapNode(mimic, nodeId, (n) => {
    const props = { ...(n.props ?? {}) };
    if (clearing) delete props[key];
    else props[key] = value;
    return { ...n, props: Object.keys(props).length ? props : undefined };
  });
}

/** 不可变设置节点显示名（空白视为清除，回落显示节点 id）。 */
export function setNodeLabel(mimic: Mimic, nodeId: string, label: string): Mimic {
  const trimmed = label.trim();
  return mapNode(mimic, nodeId, (node) => ({ ...node, label: trimmed || undefined }));
}

/** 缩放倍率合法区间（防退化为 0/负，防失控撑爆画布）。 */
const MIN_SIZE = 0.25;
const MAX_SIZE = 5;

const clampSize = (v: number): number => Math.min(MAX_SIZE, Math.max(MIN_SIZE, v));

/** 不可变设置节点横/纵缩放倍率（各自钳到 [0.25, 5]；缺省 sizeY=sizeX 即等比；倍率 1 写 undefined 省字段）。 */
export function setNodeSize(mimic: Mimic, nodeId: string, sizeX: number, sizeY: number = sizeX): Mimic {
  const cx = clampSize(sizeX);
  const cy = clampSize(sizeY);
  return mapNode(mimic, nodeId, (node) => ({
    ...node,
    sizeX: cx === 1 ? undefined : cx,
    sizeY: cy === 1 ? undefined : cy,
  }));
}

/** 不可变设置节点旋转角（规整到 [0,360)；0 写入显式 0 与新增默认一致）。 */
export function setNodeRotation(mimic: Mimic, nodeId: string, deg: number): Mimic {
  const norm = ((deg % 360) + 360) % 360;
  return mapNode(mimic, nodeId, (node) => ({ ...node, rotation: norm }));
}

/** 不可变设置图纸标题（meta.name）。空白或未变则原样返回。 */
export function setMimicName(mimic: Mimic, name: string): Mimic {
  const trimmed = name.trim();
  if (!trimmed || trimmed === mimic.meta.name) return mimic;
  return { ...mimic, meta: { ...mimic.meta, name: trimmed } };
}

/**
 * 不可变整列表替换设备动作（增删改排序由 UI 组装新列表后一次提交；空列表即清除）。
 * 浅拷贝列表本身；元素与其 items 为共享引用——调用方提交后不得再修改传入列表或其元素（与 publishPresets 同约定）。
 */
export function setNodeActions(mimic: Mimic, nodeId: string, actions: readonly DeviceAction[] | undefined): Mimic {
  return mapNode(mimic, nodeId, (node) => ({
    ...node,
    actions: actions && actions.length > 0 ? [...actions] : undefined,
  }));
}

/** 不可变设置节点某字段的绑定；自动把 topic 加入订阅列表（未订阅则收不到数据）。 */
export function setNodeBinding(mimic: Mimic, nodeId: string, key: string, binding: Binding): Mimic {
  return mapNode(mimic, nodeId, (node) => ({
    ...node,
    bindings: { ...node.bindings, [key]: { ...binding } },
    topics: node.topics.includes(binding.topic) ? node.topics : [...node.topics, binding.topic],
  }));
}

/** 不可变移除节点某字段的绑定（保留 topics 订阅，避免误删其它字段共享的 topic）。 */
export function removeNodeBinding(mimic: Mimic, nodeId: string, key: string): Mimic {
  return mapNode(mimic, nodeId, (node) => {
    if (!(key in node.bindings)) return node;
    const next = { ...node.bindings };
    delete next[key];
    return { ...node, bindings: next };
  });
}

/**
 * 不可变按世界坐标增量移动一组节点（框选批量拖拽用）。连线端点跟随：起点 points[0] 跟随 from 在集合中、
 * 终点 points[末] 跟随 to 在集合中；中间折点不变（保持走线形状）。两端都在集合内则整条边平移。
 */
export function moveNodesBy(mimic: Mimic, nodeIds: readonly string[], dx: number, dy: number): Mimic {
  if ((dx === 0 && dy === 0) || nodeIds.length === 0) return mimic;
  const ids = new Set(nodeIds);
  let moved = false;
  const nodes = mimic.nodes.map((node) => {
    if (!ids.has(node.id)) return node;
    moved = true;
    return { ...node, x: node.x + dx, y: node.y + dy };
  });
  if (!moved) return mimic;
  const edges = mimic.edges.map((edge) => {
    const movesFrom = edge.from ? ids.has(edge.from) : false;
    const movesTo = edge.to ? ids.has(edge.to) : false;
    if (!movesFrom && !movesTo) return edge;
    const last = edge.points.length - 1;
    const points = edge.points.map((p, i) =>
      (movesFrom && i === 0) || (movesTo && i === last) ? ([p[0] + dx, p[1] + dy] as [number, number]) : p,
    );
    return { ...edge, points };
  });
  return { ...mimic, nodes, edges };
}

/** 不可变按世界坐标增量移动单个节点（moveNodesBy 的单节点封装）。 */
export function moveNodeBy(mimic: Mimic, nodeId: string, dx: number, dy: number): Mimic {
  return moveNodesBy(mimic, [nodeId], dx, dy);
}

/** 不可变新增节点订阅 topic（去空白；已存在则原样返回该节点）。 */
export function addNodeTopic(mimic: Mimic, nodeId: string, topic: string): Mimic {
  const t = topic.trim();
  if (!t) return mimic;
  return mapNode(mimic, nodeId, (node) =>
    node.topics.includes(t) ? node : { ...node, topics: [...node.topics, t] },
  );
}

/** 不可变移除节点订阅 topic，并清除引用它的字段绑定（避免悬空绑定）。 */
export function removeNodeTopic(mimic: Mimic, nodeId: string, topic: string): Mimic {
  return mapNode(mimic, nodeId, (node) => {
    if (!node.topics.includes(topic)) return node;
    const bindings: Record<string, Binding> = {};
    for (const [key, binding] of Object.entries(node.bindings)) {
      if (binding.topic !== topic) bindings[key] = binding;
    }
    return { ...node, topics: node.topics.filter((t) => t !== topic), bindings };
  });
}

/** 不可变新增额外数据点（纯显示，不驱动图元）；自动订阅其 topic。 */
export function addNodeWatch(mimic: Mimic, nodeId: string, watch: WatchPoint): Mimic {
  return mapNode(mimic, nodeId, (node) => ({
    ...node,
    watches: [...(node.watches ?? []), watch],
    topics: node.topics.includes(watch.topic) ? node.topics : [...node.topics, watch.topic],
  }));
}

/** 不可变移除第 index 个额外数据点。 */
export function removeNodeWatch(mimic: Mimic, nodeId: string, index: number): Mimic {
  return mapNode(mimic, nodeId, (node) => {
    const watches = node.watches ?? [];
    if (index < 0 || index >= watches.length) return node;
    return { ...node, watches: watches.filter((_, i) => i !== index) };
  });
}

/** 不可变更新第 index 个额外数据点（打补丁，如改来源/配清告警阈值）。换 topic 自动订阅。越界原样返回。 */
export function updateNodeWatch(mimic: Mimic, nodeId: string, index: number, patch: Partial<WatchPoint>): Mimic {
  return mapNode(mimic, nodeId, (node) => {
    const watches = node.watches ?? [];
    if (index < 0 || index >= watches.length) return node;
    return {
      ...node,
      watches: watches.map((w, i) => {
        if (i !== index) return w;
        const next: Record<string, unknown> = { ...w, ...patch };
        // 显式传 undefined 表示删除该键（如清除 alarms），保持序列化干净
        for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
        return next as WatchPoint;
      }),
      // 换来源 topic：自动并入订阅（同 addNodeWatch），否则新 topic 收不到数据
      topics: patch.topic && !node.topics.includes(patch.topic) ? [...node.topics, patch.topic] : node.topics,
    };
  });
}

/** 取该 type 的下一个唯一 id（type-1、type-2…，跳过已占用，兼容任意已有 id）。 */
function nextNodeId(mimic: Mimic, type: string): string {
  const taken = new Set(mimic.nodes.map((n) => n.id));
  let n = 1;
  while (taken.has(`${type}-${n}`)) n++;
  return `${type}-${n}`;
}

/**
 * 不可变在世界坐标 (x,y) 新建一个 type 节点（调色板放置用）。默认 label=id、空绑定。
 * 返回新 mimic 与新节点 id（供上层自动选中直接配置）。
 */
export function addNode(mimic: Mimic, type: string, x: number, y: number): { mimic: Mimic; id: string } {
  const id = nextNodeId(mimic, type);
  const node: MimicNode = { id, type, x, y, rotation: 0, label: id, topics: [], bindings: {}, inline: [] };
  return { mimic: { ...mimic, nodes: [...mimic.nodes, node] }, id };
}

/**
 * 不可变复制若干节点：每个复制体偏移 (dx,dy)、取该类型下一个唯一 id（防 zod 撞 id）。
 * 只复制元件本体（含绑定/props/尺寸/旋转），**不复制连线**——避免重复线缠绕。
 * 返回新 mimic 与新 id 列表（供上层选中复制体）。
 */
export function duplicateNodes(
  mimic: Mimic,
  nodeIds: readonly string[],
  dx: number,
  dy: number,
): { mimic: Mimic; ids: string[] } {
  const ids: string[] = [];
  let next = mimic;
  for (const srcId of nodeIds) {
    const src = next.nodes.find((n) => n.id === srcId);
    if (!src) continue;
    const id = nextNodeId(next, src.type);
    const copy: MimicNode = {
      ...src,
      id,
      x: src.x + dx,
      y: src.y + dy,
      // 标签曾=旧 id（自动名）→ 跟新 id；用户改过的名（≠id）保留。
      label: src.label === src.id ? id : src.label,
    };
    next = { ...next, nodes: [...next.nodes, copy] };
    ids.push(id);
  }
  return { mimic: next, ids };
}

/**
 * 不可变粘贴节点（来自剪贴板快照）：保持相对布局，整组**左上角锚定到 (atX, atY)**，
 * 每个取该类型下一个唯一 id；不带连线。返回新 mimic 与新 id 列表（供上层选中）。
 */
export function pasteNodes(
  mimic: Mimic,
  nodes: readonly MimicNode[],
  atX: number,
  atY: number,
): { mimic: Mimic; ids: string[] } {
  if (nodes.length === 0) return { mimic, ids: [] };
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const ids: string[] = [];
  let next = mimic;
  for (const src of nodes) {
    const id = nextNodeId(next, src.type);
    const copy: MimicNode = {
      ...src,
      id,
      x: atX + (src.x - minX),
      y: atY + (src.y - minY),
      label: src.label === src.id ? id : src.label,
    };
    next = { ...next, nodes: [...next.nodes, copy] };
    ids.push(id);
  }
  return { mimic: next, ids };
}

/** 取下一个唯一连线 id（e-1、e-2…，跳过已占用，兼容任意已有 id）。 */
function nextEdgeId(mimic: Mimic): string {
  const taken = new Set(mimic.edges.map((e) => e.id));
  let n = 1;
  while (taken.has(`e-${n}`)) n++;
  return `e-${n}`;
}

/** 连线一端：节点 id 或自由点（恰一），节点端可带出/入口方位。 */
export interface EdgeEnd {
  readonly node?: string;
  readonly point?: readonly [number, number];
  readonly side?: EdgeSide;
}

/**
 * 不可变新增连线（端点 = 节点或自由点）。auto=true（渲染按实时位置重算）；points 存当前快照兜底。
 * 两端同一节点（自连）或点数不足 → 原样返回。
 */
export function addEdgeEnds(
  mimic: Mimic,
  from: EdgeEnd,
  to: EdgeEnd,
  points: readonly (readonly [number, number])[],
  lead?: boolean,
): Mimic {
  // 每端必须「节点 id XOR 自由点」恰一，否则违反 edgeSchema.superRefine —— 防御性早返。
  if (!!from.node === !!from.point || !!to.node === !!to.point) return mimic;
  if ((from.node && from.node === to.node) || points.length < 2) return mimic;
  const edge: MimicEdge = {
    id: nextEdgeId(mimic),
    ...(from.node ? { from: from.node } : {}),
    ...(to.node ? { to: to.node } : {}),
    ...(from.point ? { fromPoint: [from.point[0], from.point[1]] as [number, number] } : {}),
    ...(to.point ? { toPoint: [to.point[0], to.point[1]] as [number, number] } : {}),
    auto: true,
    points: points.map((p) => [p[0], p[1]] as [number, number]),
    ...(lead ? { lead: true } : {}),
    ...(from.side ? { fromSide: from.side } : {}),
    ...(to.side ? { toSide: to.side } : {}),
  };
  return { ...mimic, edges: [...mimic.edges, edge] };
}

/** 旧签名（节点→节点）委托 addEdgeEnds，保持 HmiPage 现有调用不变。 */
export function addEdge(
  mimic: Mimic,
  from: string,
  to: string,
  points: readonly (readonly [number, number])[],
  sides?: { fromSide?: EdgeSide; toSide?: EdgeSide },
  lead?: boolean,
): Mimic {
  if (from === to) return mimic;
  return addEdgeEnds(mimic, { node: from, side: sides?.fromSide }, { node: to, side: sides?.toSide }, points, lead);
}

/** 不可变切换某条边的引线（虚线信号线）样式。lead=false 省字段。 */
export function setEdgeLead(mimic: Mimic, edgeId: string, lead: boolean): Mimic {
  let changed = false;
  const edges = mimic.edges.map((e) => {
    if (e.id !== edgeId) return e;
    changed = true;
    const { lead: _omit, ...rest } = e;
    return (lead ? { ...rest, lead: true } : rest) as MimicEdge;
  });
  return changed ? { ...mimic, edges } : mimic;
}

/** 不可变删除一条连线（按 id）。不存在 → 原样返回。 */
export function removeEdge(mimic: Mimic, edgeId: string): Mimic {
  const edges = mimic.edges.filter((e) => e.id !== edgeId);
  return edges.length === mimic.edges.length ? mimic : { ...mimic, edges };
}

/**
 * 不可变设某条边的某端为节点或自由点（互斥：设节点清 *Point，设自由点清 node+side）。同步 points 端点快照。
 * end.node → 锚定到节点（清 *Point，设 from/to + 可选 *Side）；
 * end.point → 解锚为自由点（清 from/to + *Side，设 *Point，刷新 points 首/末快照）。
 */
export function setEdgeEnd(mimic: Mimic, edgeId: string, which: "from" | "to", end: EdgeEnd): Mimic {
  let changed = false;
  const edges = mimic.edges.map((e) => {
    if (e.id !== edgeId) return e;
    changed = true;
    const isFrom = which === "from";
    // 「另一端」的字段（保持不变）
    const otherFromFields: Partial<MimicEdge> = isFrom
      ? {}
      : e.from
        ? { from: e.from, ...(e.fromSide ? { fromSide: e.fromSide } : {}) }
        : { fromPoint: e.fromPoint };
    const otherToFields: Partial<MimicEdge> = isFrom
      ? e.to
        ? { to: e.to, ...(e.toSide ? { toSide: e.toSide } : {}) }
        : { toPoint: e.toPoint }
      : {};
    const common: Partial<MimicEdge> = {
      ...(e.flowBy ? { flowBy: e.flowBy } : {}),
      ...(e.lead ? { lead: e.lead } : {}),
      ...(e.auto ? { auto: e.auto } : {}),
    };

    if (end.node) {
      // 锚定到节点：设 from/to，清 *Point，可选设 *Side
      const thisFields: Partial<MimicEdge> = isFrom
        ? { from: end.node, ...(end.side ? { fromSide: end.side } : {}) }
        : { to: end.node, ...(end.side ? { toSide: end.side } : {}) };
      return { id: e.id, ...otherFromFields, ...otherToFields, ...thisFields, points: e.points, ...common } as MimicEdge;
    } else if (end.point) {
      // 解锚为自由点：清 from/to + *Side，设 *Point，刷新 points 首/末快照
      const idx = isFrom ? 0 : e.points.length - 1;
      const pt: [number, number] = [end.point[0], end.point[1]];
      const points = e.points.map((p, i): [number, number] => (i === idx ? pt : [p[0], p[1]]));
      const thisFields: Partial<MimicEdge> = isFrom ? { fromPoint: pt } : { toPoint: pt };
      return { id: e.id, ...otherFromFields, ...otherToFields, ...thisFields, points, ...common } as MimicEdge;
    }
    return e;
  });
  return changed ? { ...mimic, edges } : mimic;
}

/** 不可变删除一组节点，并连带删除引用它们的连线（from/to 命中即删）。空集合/全不存在 → 原样返回。 */
export function removeNodes(mimic: Mimic, nodeIds: readonly string[]): Mimic {
  if (nodeIds.length === 0) return mimic;
  const ids = new Set(nodeIds);
  const nodes = mimic.nodes.filter((n) => !ids.has(n.id));
  if (nodes.length === mimic.nodes.length) return mimic;
  const edges = mimic.edges.filter((e) => !(e.from && ids.has(e.from)) && !(e.to && ids.has(e.to)));
  return { ...mimic, nodes, edges };
}

/**
 * 不可变整体平移选中节点与自由点边（框选后批量拖拽用）。
 * 先平移选中的节点（复用 moveNodesBy 语义，节点锚端自动跟随），
 * 再平移选中边的自由点端（fromPoint/toPoint/points 各加偏移）；
 * 节点端不在此动（已通过 moveNodesBy 跟随）。
 */
export function moveSelectionBy(
  mimic: Mimic,
  nodeIds: readonly string[],
  edgeIds: readonly string[],
  dx: number,
  dy: number,
): Mimic {
  if (dx === 0 && dy === 0) return mimic;
  const moved = nodeIds.length ? moveNodesBy(mimic, nodeIds, dx, dy) : mimic;
  if (edgeIds.length === 0) return moved;
  const eids = new Set(edgeIds);
  const shift = (p: readonly [number, number]) => [p[0] + dx, p[1] + dy] as [number, number];
  const edges = moved.edges.map((e) => {
    if (!eids.has(e.id)) return e;
    return {
      ...e,
      ...(e.fromPoint ? { fromPoint: shift(e.fromPoint) } : {}),
      ...(e.toPoint ? { toPoint: shift(e.toPoint) } : {}),
      points: e.points.map(shift),
    };
  });
  return { ...moved, edges };
}
