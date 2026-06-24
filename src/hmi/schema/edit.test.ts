import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setNodeBinding, setNodeLabel, setNodeRotation, setNodeSize, removeNodeBinding, addNodeTopic, removeNodeTopic, moveNodeBy, moveNodesBy, addNode, addEdge, removeNodes, addNodeWatch, removeNodeWatch, updateNodeWatch, setNodeActions, removeEdge, addEdgeEnds, setEdgeEnd, setEdgeLead, moveSelectionBy, setNodeProp, duplicateNodes, pasteNodes } from "./edit";
import { parseMimic, type Mimic } from "./schema";

const base: Mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [{ id: "P-01", type: "pump", x: 0, y: 0, topics: ["t/a"], bindings: { running: { topic: "t/a", path: "s" } } }],
  edges: [],
}).data!;

describe("addEdge（画线工具）", () => {
  it("新增连线：自动取唯一 id、带 auto 标志（渲染时按图元位置重算轨迹）", () => {
    const next = addEdge(base, "P-01", "TK-01", [[0, 0], [50, 0], [50, 40]]);
    assert.equal(next.edges.length, 1);
    assert.deepEqual(next.edges[0], { id: "e-1", from: "P-01", to: "TK-01", auto: true, points: [[0, 0], [50, 0], [50, 40]] });
    assert.equal(base.edges.length, 0); // 不可变
  });
  it("id 顺延跳过已占用", () => {
    const a = addEdge(base, "A", "B", [[0, 0], [1, 1]]);
    const b = addEdge(a, "B", "C", [[1, 1], [2, 2]]);
    assert.deepEqual(b.edges.map((e) => e.id), ["e-1", "e-2"]);
  });
  it("自连 / 点数不足 → 原样返回", () => {
    assert.equal(addEdge(base, "P-01", "P-01", [[0, 0], [1, 1]]), base);
    assert.equal(addEdge(base, "A", "B", [[0, 0]]), base);
  });
  it("lead=true：标记仪表引线（渲染虚线）；缺省不带 lead", () => {
    assert.equal(addEdge(base, "A", "B", [[0, 0], [1, 1]], undefined, true).edges[0].lead, true);
    assert.equal(addEdge(base, "A", "B", [[0, 0], [1, 1]]).edges[0].lead, undefined);
  });
});

describe("duplicateNodes（复制元件）", () => {
  const m = parseMimic({
    meta: { name: "x", version: 1 },
    nodes: [
      { id: "P-01", type: "pump", x: 10, y: 20, label: "P-01", topics: ["t/a"], bindings: { running: { topic: "t/a", path: "s" } } },
      { id: "V-09", type: "valve", x: 0, y: 0, label: "进料阀" },
    ],
    edges: [],
  }).data!;

  it("新唯一 id + 偏移坐标 + 拷贝绑定/topic；不带连线；不可变", () => {
    const { mimic, ids } = duplicateNodes(m, ["P-01"], 30, 30);
    assert.equal(ids.length, 1);
    const copy = mimic.nodes.find((n) => n.id === ids[0])!;
    assert.equal(copy.type, "pump");
    assert.equal(copy.x, 40);
    assert.equal(copy.y, 50);
    assert.deepEqual(copy.topics, ["t/a"]);
    assert.deepEqual(copy.bindings, { running: { topic: "t/a", path: "s" } });
    assert.notEqual(copy.id, "P-01");
    assert.equal(mimic.edges.length, 0);
    assert.equal(m.nodes.length, 2); // 原图未变
  });
  it("label 处理：曾=旧 id → 跟新 id；用户名（≠id）保留", () => {
    const c1 = (() => { const r = duplicateNodes(m, ["P-01"], 1, 1); return r.mimic.nodes.find((n) => n.id === r.ids[0])!; })();
    assert.equal(c1.label, c1.id);
    const c2 = (() => { const r = duplicateNodes(m, ["V-09"], 1, 1); return r.mimic.nodes.find((n) => n.id === r.ids[0])!; })();
    assert.equal(c2.label, "进料阀");
  });
  it("多节点：各取唯一 id 互不撞；不存在的 id 跳过", () => {
    const { mimic, ids } = duplicateNodes(m, ["P-01", "V-09", "MISSING"], 5, 5);
    assert.equal(ids.length, 2);
    assert.equal(new Set(ids).size, 2);
    assert.equal(mimic.nodes.length, 4);
  });
});

describe("pasteNodes（粘贴）", () => {
  const m = parseMimic({ meta: { name: "x", version: 1 }, nodes: [{ id: "P-01", type: "pump", x: 0, y: 0 }], edges: [] }).data!;
  const clip = parseMimic({
    meta: { name: "y", version: 1 },
    nodes: [
      { id: "A", type: "valve", x: 100, y: 100, label: "A" },
      { id: "B", type: "tank", x: 140, y: 120, label: "罐B" },
    ],
    edges: [],
  }).data!.nodes;

  it("整组左上角锚定到 (atX,atY)、保持相对布局、新唯一 id、不带连线、不可变", () => {
    const { mimic, ids } = pasteNodes(m, clip, 500, 300);
    assert.equal(ids.length, 2);
    const a = mimic.nodes.find((n) => n.id === ids[0])!;
    const b = mimic.nodes.find((n) => n.id === ids[1])!;
    assert.equal(a.x, 500); assert.equal(a.y, 300); // 组左上角 (100,100) → (500,300)
    assert.equal(b.x, 540); assert.equal(b.y, 320); // 相对 (+40,+20) 保持
    assert.equal(b.label, "罐B"); // 用户名保留
    assert.equal(mimic.edges.length, 0);
    assert.equal(m.nodes.length, 1); // 原图未变
  });
  it("空剪贴板 → 原样返回", () => {
    const r = pasteNodes(m, [], 0, 0);
    assert.equal(r.ids.length, 0);
    assert.equal(r.mimic, m);
  });
});

describe("setNodeBinding (不可变)", () => {
  it("设置某属性绑定", () => {
    const next = setNodeBinding(base, "P-01", "rpm", { topic: "t/b", path: "rpm" });
    assert.deepEqual(next.nodes[0].bindings.rpm, { topic: "t/b", path: "rpm" });
    assert.equal(base.nodes[0].bindings.rpm, undefined);
  });
  it("绑定新 topic 时自动加入订阅列表", () => {
    const next = setNodeBinding(base, "P-01", "rpm", { topic: "t/b", path: "rpm" });
    assert.ok(next.nodes[0].topics.includes("t/b"));
  });
  it("绑定已订阅 topic 时不重复添加", () => {
    const next = setNodeBinding(base, "P-01", "rpm", { topic: "t/a", path: "rpm" });
    assert.deepEqual(next.nodes[0].topics, ["t/a"]);
  });
});

describe("setNodeLabel (不可变)", () => {
  it("设置显示名", () => {
    const next = setNodeLabel(base, "P-01", "进料泵 A");
    assert.equal(next.nodes[0].label, "进料泵 A");
    assert.equal(base.nodes[0].label, undefined); // 原对象不变
  });
  it("空白清除 → undefined（回落显示 id）", () => {
    const named = setNodeLabel(base, "P-01", "临时");
    assert.equal(setNodeLabel(named, "P-01", "  ").nodes[0].label, undefined);
  });
});

describe("setNodeSize (分轴缩放/拉伸，不可变)", () => {
  it("单参 = 等比：sizeX=sizeY，原图不变", () => {
    const next = setNodeSize(base, "P-01", 2);
    assert.equal(next.nodes[0].sizeX, 2);
    assert.equal(next.nodes[0].sizeY, 2);
    assert.equal(base.nodes[0].sizeX, undefined);
    assert.notEqual(next, base);
  });
  it("双参 = 拉伸：sizeX≠sizeY 各自独立", () => {
    const next = setNodeSize(base, "P-01", 2, 0.5);
    assert.equal(next.nodes[0].sizeX, 2);
    assert.equal(next.nodes[0].sizeY, 0.5);
  });
  it("各轴钳到 [0.25, 5]", () => {
    const a = setNodeSize(base, "P-01", 99, 0);
    assert.equal(a.nodes[0].sizeX, 5);
    assert.equal(a.nodes[0].sizeY, 0.25);
  });
  it("倍率 1 写 undefined（省字段，回落原始尺寸）", () => {
    const big = setNodeSize(base, "P-01", 2, 3);
    const reset = setNodeSize(big, "P-01", 1, 1);
    assert.equal(reset.nodes[0].sizeX, undefined);
    assert.equal(reset.nodes[0].sizeY, undefined);
  });
});

describe("setNodeRotation (旋转，不可变)", () => {
  it("规整到 [0,360)", () => {
    assert.equal(setNodeRotation(base, "P-01", 90).nodes[0].rotation, 90);
    assert.equal(setNodeRotation(base, "P-01", 450).nodes[0].rotation, 90);
    assert.equal(setNodeRotation(base, "P-01", -90).nodes[0].rotation, 270);
  });
  it("不改原图", () => {
    const next = setNodeRotation(base, "P-01", 90);
    assert.equal(base.nodes[0].rotation, 0);
    assert.notEqual(next, base);
  });
});

describe("removeNodeBinding (不可变)", () => {
  it("移除字段绑定，保留 topics", () => {
    const next = removeNodeBinding(base, "P-01", "running");
    assert.equal(next.nodes[0].bindings.running, undefined);
    assert.deepEqual(next.nodes[0].topics, ["t/a"]);
    assert.ok("running" in base.nodes[0].bindings); // 原对象不变
  });
  it("不存在的字段：原样返回节点", () => {
    const next = removeNodeBinding(base, "P-01", "nope");
    assert.equal(next.nodes[0], base.nodes[0]);
  });
});

describe("addNodeTopic (不可变)", () => {
  it("新增 topic 进订阅列表", () => {
    const next = addNodeTopic(base, "P-01", "t/b");
    assert.deepEqual(next.nodes[0].topics, ["t/a", "t/b"]);
    assert.deepEqual(base.nodes[0].topics, ["t/a"]); // 原对象不变
  });
  it("已存在 topic 不重复添加", () => {
    const next = addNodeTopic(base, "P-01", "t/a");
    assert.equal(next.nodes[0], base.nodes[0]);
  });
  it("空白 topic 原样返回", () => {
    assert.equal(addNodeTopic(base, "P-01", "  "), base);
  });
});

describe("removeNodeTopic (不可变)", () => {
  it("移除 topic 并清除引用它的绑定", () => {
    const next = removeNodeTopic(base, "P-01", "t/a");
    assert.deepEqual(next.nodes[0].topics, []);
    assert.equal(next.nodes[0].bindings.running, undefined); // running 绑在 t/a → 一并清除
    assert.ok("running" in base.nodes[0].bindings); // 原对象不变
  });
  it("保留绑在其它 topic 的字段", () => {
    const two = setNodeBinding(base, "P-01", "rpm", { topic: "t/b", path: "rpm" });
    const next = removeNodeTopic(two, "P-01", "t/a");
    assert.equal(next.nodes[0].bindings.running, undefined);
    assert.deepEqual(next.nodes[0].bindings.rpm, { topic: "t/b", path: "rpm" });
    assert.deepEqual(next.nodes[0].topics, ["t/b"]);
  });
  it("不存在的 topic：原样返回节点", () => {
    const next = removeNodeTopic(base, "P-01", "nope");
    assert.equal(next.nodes[0], base.nodes[0]);
  });
});

describe("moveNodeBy (不可变)", () => {
  const withEdge: Mimic = parseMimic({
    meta: { name: "x", version: 1 },
    nodes: [
      { id: "A", type: "pump", x: 100, y: 100, topics: [], bindings: {} },
      { id: "B", type: "tank", x: 300, y: 100, topics: [], bindings: {} },
    ],
    edges: [{ id: "e1", from: "A", to: "B", points: [[120, 100], [200, 100], [280, 100]] }],
  }).data!;

  it("移动节点坐标；from 边动起点、to 边动终点，中间折点不变", () => {
    const next = moveNodeBy(withEdge, "A", 10, 20);
    assert.deepEqual([next.nodes[0].x, next.nodes[0].y], [110, 120]); // A 移动
    assert.deepEqual([next.nodes[1].x, next.nodes[1].y], [300, 100]); // B 不动
    const pts = next.edges[0].points;
    assert.deepEqual(pts[0], [130, 120]); // 起点(from=A) 跟随
    assert.deepEqual(pts[1], [200, 100]); // 中间折点不变
    assert.deepEqual(pts[2], [280, 100]); // 终点(to=B) 不变
    assert.deepEqual([withEdge.nodes[0].x, withEdge.edges[0].points[0]], [100, [120, 100]]); // 原对象不变
  });

  it("移动 to 节点 → 仅边终点跟随", () => {
    const pts = moveNodeBy(withEdge, "B", -10, 5).edges[0].points;
    assert.deepEqual(pts[0], [120, 100]); // 起点不变
    assert.deepEqual(pts[2], [270, 105]); // 终点(to=B) 跟随
  });

  it("零增量 / 不存在节点：原样返回", () => {
    assert.equal(moveNodeBy(withEdge, "A", 0, 0), withEdge);
    assert.equal(moveNodeBy(withEdge, "nope", 5, 5), withEdge);
  });
});

describe("moveNodesBy (框选批量拖拽，不可变)", () => {
  const three: Mimic = parseMimic({
    meta: { name: "x", version: 1 },
    nodes: [
      { id: "A", type: "pump", x: 100, y: 100, topics: [], bindings: {} },
      { id: "B", type: "tank", x: 300, y: 100, topics: [], bindings: {} },
      { id: "C", type: "valve", x: 500, y: 100, topics: [], bindings: {} },
    ],
    edges: [{ id: "e1", from: "A", to: "B", points: [[120, 100], [200, 100], [280, 100]] }],
  }).data!;

  it("整组按增量平移，未选中的不动", () => {
    const next = moveNodesBy(three, ["A", "C"], 10, 20);
    assert.deepEqual([next.nodes[0].x, next.nodes[0].y], [110, 120]); // A 选中→动
    assert.deepEqual([next.nodes[1].x, next.nodes[1].y], [300, 100]); // B 未选→不动
    assert.deepEqual([next.nodes[2].x, next.nodes[2].y], [510, 120]); // C 选中→动
  });

  it("两端都在集合内 → 整条边平移（起点+终点都跟随）", () => {
    const pts = moveNodesBy(three, ["A", "B"], 10, 20).edges[0].points;
    assert.deepEqual(pts[0], [130, 120]); // 起点(from=A∈集合) 跟随
    assert.deepEqual(pts[1], [200, 100]); // 中间折点不变
    assert.deepEqual(pts[2], [290, 120]); // 终点(to=B∈集合) 跟随
  });

  it("只有一端在集合内 → 仅该端点跟随", () => {
    const pts = moveNodesBy(three, ["A"], 10, 20).edges[0].points;
    assert.deepEqual(pts[0], [130, 120]); // from=A 跟随
    assert.deepEqual(pts[2], [280, 100]); // to=B 不在集合→不动
  });

  it("零增量 / 空集合 / 全不存在：原样返回", () => {
    assert.equal(moveNodesBy(three, ["A"], 0, 0), three);
    assert.equal(moveNodesBy(three, [], 5, 5), three);
    assert.equal(moveNodesBy(three, ["nope"], 5, 5), three);
  });

  it("不可变：原对象与原节点引用不变", () => {
    const next = moveNodesBy(three, ["A"], 5, 5);
    assert.equal(three.nodes[0].x, 100);
    assert.equal(next.nodes[1], three.nodes[1]); // 未动节点保持同一引用
  });
});

describe("addNode (调色板放置，不可变)", () => {
  const empty: Mimic = parseMimic({ meta: { name: "x", version: 1 }, nodes: [], edges: [] }).data!;

  it("在落点新建默认节点，返回新 id；原对象不变", () => {
    const { mimic, id } = addNode(empty, "pump", 120, 80);
    assert.equal(id, "pump-1");
    assert.equal(mimic.nodes.length, 1);
    assert.deepEqual(
      { ...mimic.nodes[0] },
      { id: "pump-1", type: "pump", x: 120, y: 80, rotation: 0, label: "pump-1", topics: [], bindings: {}, inline: [] },
    );
    assert.equal(empty.nodes.length, 0); // 原对象不变
  });

  it("id 自增且唯一（跳过已占用）", () => {
    const a = addNode(empty, "valve", 0, 0);
    const b = addNode(a.mimic, "valve", 10, 10);
    assert.deepEqual([a.id, b.id], ["valve-1", "valve-2"]);
  });

  it("已有同型 id 时跳号避免冲突", () => {
    const seeded = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "valve-1", type: "valve", x: 0, y: 0, topics: [], bindings: {} }],
      edges: [],
    }).data!;
    assert.equal(addNode(seeded, "valve", 5, 5).id, "valve-2");
  });

  it("新建结果通过 schema 校验", () => {
    const { mimic } = addNode(empty, "tank", 1, 2);
    assert.equal(parseMimic(mimic).ok, true);
  });
});

describe("removeNodes (删除，不可变)", () => {
  const g: Mimic = parseMimic({
    meta: { name: "x", version: 1 },
    nodes: [
      { id: "A", type: "pump", x: 0, y: 0, topics: [], bindings: {} },
      { id: "B", type: "tank", x: 100, y: 0, topics: [], bindings: {} },
      { id: "C", type: "valve", x: 200, y: 0, topics: [], bindings: {} },
    ],
    edges: [
      { id: "e1", from: "A", to: "B", points: [[0, 0], [100, 0]] },
      { id: "e2", from: "B", to: "C", points: [[100, 0], [200, 0]] },
    ],
  }).data!;

  it("删节点并连带删引用它的连线", () => {
    const next = removeNodes(g, ["B"]);
    assert.deepEqual(next.nodes.map((n) => n.id), ["A", "C"]);
    assert.deepEqual(next.edges.map((e) => e.id), []); // e1(到B)、e2(从B) 都删
    assert.equal(g.nodes.length, 3); // 原对象不变
  });

  it("只删一端不相关的边保留", () => {
    const next = removeNodes(g, ["A"]);
    assert.deepEqual(next.nodes.map((n) => n.id), ["B", "C"]);
    assert.deepEqual(next.edges.map((e) => e.id), ["e2"]); // e1 含 A 删，e2 保留
  });

  it("批量删除多个节点", () => {
    const next = removeNodes(g, ["A", "C"]);
    assert.deepEqual(next.nodes.map((n) => n.id), ["B"]);
    assert.deepEqual(next.edges.map((e) => e.id), []);
  });

  it("空集合 / 全不存在：原样返回同一引用", () => {
    assert.equal(removeNodes(g, []), g);
    assert.equal(removeNodes(g, ["nope"]), g);
  });
});

describe("addNodeWatch / removeNodeWatch (不可变)", () => {
  it("新增额外数据点并自动订阅其 topic", () => {
    const next = addNodeWatch(base, "P-01", { label: "温度", topic: "t/temp", path: "v" });
    assert.deepEqual(next.nodes[0].watches, [{ label: "温度", topic: "t/temp", path: "v" }]);
    assert.ok(next.nodes[0].topics.includes("t/temp"));
    assert.equal(base.nodes[0].watches, undefined); // 原对象不变
  });
  it("数据点的 topic 已订阅则不重复加", () => {
    const next = addNodeWatch(base, "P-01", { label: "x", topic: "t/a", path: "p" });
    assert.deepEqual(next.nodes[0].topics, ["t/a"]);
  });
  it("移除第 index 个数据点", () => {
    const a = addNodeWatch(base, "P-01", { label: "a", topic: "t/x", path: "1" });
    const two = addNodeWatch(a, "P-01", { label: "b", topic: "t/y", path: "2" });
    const next = removeNodeWatch(two, "P-01", 0);
    assert.deepEqual(next.nodes[0].watches, [{ label: "b", topic: "t/y", path: "2" }]);
  });
  it("越界 index：原样返回节点", () => {
    assert.equal(removeNodeWatch(base, "P-01", 5).nodes[0], base.nodes[0]);
  });
});

describe("updateNodeWatch (不可变)", () => {
  it("按 index 打补丁（如配告警阈值），其余 watch 不动，原对象不变", () => {
    const a = addNodeWatch(base, "P-01", { label: "a", topic: "t/x", path: "1" });
    const two = addNodeWatch(a, "P-01", { label: "b", topic: "t/y", path: "2" });
    const next = updateNodeWatch(two, "P-01", 1, { alarms: { hihi: 8 } });
    assert.deepEqual(next.nodes[0].watches?.[1], { label: "b", topic: "t/y", path: "2", alarms: { hihi: 8 } });
    assert.deepEqual(next.nodes[0].watches?.[0], { label: "a", topic: "t/x", path: "1" });
    assert.equal(two.nodes[0].watches?.[1].alarms, undefined); // 原对象不变
  });
  it("alarms 置 undefined 可清除阈值", () => {
    const a = addNodeWatch(base, "P-01", { label: "a", topic: "t/x", path: "1", alarms: { hi: 5 } });
    const next = updateNodeWatch(a, "P-01", 0, { alarms: undefined });
    assert.equal(next.nodes[0].watches?.[0].alarms, undefined);
  });
  it("patch 换 topic：自动订阅新 topic（同 addNodeWatch），已订阅不重复", () => {
    const a = addNodeWatch(base, "P-01", { label: "a", topic: "t/x", path: "1" });
    const next = updateNodeWatch(a, "P-01", 0, { topic: "t/new", path: "2" });
    assert.equal(next.nodes[0].watches?.[0].topic, "t/new");
    assert.ok(next.nodes[0].topics.includes("t/new"));
    const again = updateNodeWatch(next, "P-01", 0, { topic: "t/new" });
    assert.equal(again.nodes[0].topics.filter((x) => x === "t/new").length, 1);
  });
  it("越界 index：原样返回节点", () => {
    assert.equal(updateNodeWatch(base, "P-01", 5, { alarms: { hi: 1 } }).nodes[0], base.nodes[0]);
  });
});

describe("setNodeActions (不可变)", () => {
  const actions = [{ label: "启动", items: [{ topic: "cmd/run", template: '{"run":1}' }] }];
  it("整列表替换（原 mimic 不变）", () => {
    const next = setNodeActions(base, "P-01", actions);
    assert.deepEqual(next.nodes[0].actions, actions);
    assert.equal(base.nodes[0].actions, undefined);
  });
  it("空列表/undefined 清除字段", () => {
    const a = setNodeActions(base, "P-01", actions);
    assert.equal(setNodeActions(a, "P-01", []).nodes[0].actions, undefined);
    assert.equal(setNodeActions(a, "P-01", undefined).nodes[0].actions, undefined);
  });
  it("节点不存在 → 原样返回", () => {
    assert.equal(setNodeActions(base, "NOPE", actions), base);
  });
});

describe("addEdgeEnds（自由点端点，不可变）", () => {
  it("节点→自由点 生成 from + toPoint 边", () => {
    const m0 = parseMimic({
      meta: { name: "t", version: 1 },
      interlocks: [],
      edges: [],
      nodes: [{ id: "A", type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] }],
    }).data!;
    const m1 = addEdgeEnds(m0, { node: "A", side: "R" }, { point: [50, 0] }, [[0, 0], [50, 0]]);
    const e = m1.edges[0];
    assert.equal(e.from, "A");
    assert.deepEqual(e.toPoint, [50, 0]);
    assert.equal(e.to, undefined);
    assert.equal(e.auto, true);
  });

  it("自由点→自由点 + lead", () => {
    const m0 = parseMimic({ meta: { name: "t", version: 1 }, interlocks: [], nodes: [], edges: [] }).data!;
    const m1 = addEdgeEnds(m0, { point: [0, 0] }, { point: [9, 9] }, [[0, 0], [9, 9]], true);
    assert.equal(m1.edges[0].lead, true);
    assert.deepEqual(m1.edges[0].fromPoint, [0, 0]);
  });

  it("不变式守卫：from 两字段皆缺（非节点非自由点）→ 原样返回，边数不变", () => {
    const m0 = parseMimic({ meta: { name: "t", version: 1 }, interlocks: [], nodes: [], edges: [] }).data!;
    // from = {} 既无 node 也无 point，违反 XOR —— 应原样返回
    const result = addEdgeEnds(m0, {}, { point: [10, 10] }, [[0, 0], [10, 10]]);
    assert.equal(result.edges.length, 0);
    assert.equal(result, m0);
  });

  it("不变式守卫：from 同时有 node 和 point（两者都设）→ 原样返回，边数不变", () => {
    const m0 = parseMimic({ meta: { name: "t", version: 1 }, interlocks: [], nodes: [], edges: [] }).data!;
    // from = { node: "A", point: [0,0] } 违反互斥 XOR —— 应原样返回
    const result = addEdgeEnds(m0, { node: "A", point: [0, 0] }, { point: [10, 10] }, [[0, 0], [10, 10]]);
    assert.equal(result.edges.length, 0);
    assert.equal(result, m0);
  });
});

describe("removeEdge / addEdge 端口方位 (不可变)", () => {
  it("addEdge 记录 fromSide/toSide（缺省不写字段）", () => {
    const a = addEdge(base, "A", "B", [[0, 0], [1, 1]], { fromSide: "T", toSide: "B" });
    assert.equal(a.edges[0].fromSide, "T");
    assert.equal(a.edges[0].toSide, "B");
    const b = addEdge(base, "A", "B", [[0, 0], [1, 1]]);
    assert.ok(!("fromSide" in b.edges[0]));
  });
  it("removeEdge 按 id 删除（原 mimic 不变）；不存在原样返回", () => {
    const a = addEdge(base, "A", "B", [[0, 0], [1, 1]]);
    const b = removeEdge(a, "e-1");
    assert.equal(b.edges.length, 0);
    assert.equal(a.edges.length, 1);
    assert.equal(removeEdge(a, "nope"), a);
  });
});

// 辅助：构造一个 Mimic，已通过 schema 解析
function parseOk(raw: unknown): Mimic {
  const r = parseMimic(raw);
  if (!r.ok) throw new Error(`parseOk 失败: ${r.error}`);
  return r.data!;
}

describe("setEdgeLead（不可变切换虚线引线样式）", () => {
  const withEdge: Mimic = parseMimic({
    meta: { name: "x", version: 1 },
    nodes: [
      { id: "A", type: "pump", x: 0, y: 0, topics: [], bindings: {} },
      { id: "B", type: "tank", x: 100, y: 0, topics: [], bindings: {} },
    ],
    edges: [{ id: "e-1", from: "A", to: "B", points: [[0, 0], [100, 0]] }],
  }).data!;

  it("设 lead=true：写入 lead:true 字段，原对象不变", () => {
    const next = setEdgeLead(withEdge, "e-1", true);
    assert.equal(next.edges[0].lead, true);
    assert.equal(withEdge.edges[0].lead, undefined); // 原对象不变
    assert.notEqual(next, withEdge);
  });

  it("设 lead=false：删除 lead 字段（省字段，序列化干净）", () => {
    const withLead = setEdgeLead(withEdge, "e-1", true);
    assert.equal(withLead.edges[0].lead, true);
    const next = setEdgeLead(withLead, "e-1", false);
    assert.equal(next.edges[0].lead, undefined);
    assert.ok(!("lead" in next.edges[0])); // 字段被完全删除
  });
});

describe("setEdgeEnd（不可变改端点，端点拖动用）", () => {
  it("自由点端拖到新坐标：更新 toPoint 并刷新 points 末元素", () => {
    const m0 = parseOk({
      meta: { name: "t" }, interlocks: [], nodes: [],
      edges: [{ id: "e1", fromPoint: [0, 0], toPoint: [10, 0], points: [[0, 0], [10, 0]] }],
    });
    const m1 = setEdgeEnd(m0, "e1", "to", { point: [99, 5] });
    assert.deepEqual(m1.edges[0].toPoint, [99, 5]);
    assert.deepEqual(m1.edges[0].points[1], [99, 5]); // points 末元素同步
    assert.deepEqual(m0.edges[0].toPoint, [10, 0]); // 原对象不变
  });

  it("自由点端锚定到节点：清 toPoint，设 to+toSide", () => {
    const m0 = parseOk({
      meta: { name: "t" }, interlocks: [],
      nodes: [{ id: "N", type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] }],
      edges: [{ id: "e1", fromPoint: [0, 0], toPoint: [10, 0], points: [[0, 0], [10, 0]] }],
    });
    const m1 = setEdgeEnd(m0, "e1", "to", { node: "N", side: "L" });
    assert.equal(m1.edges[0].to, "N");
    assert.equal(m1.edges[0].toSide, "L");
    assert.equal(m1.edges[0].toPoint, undefined);
    assert.deepEqual(m0.edges[0].toPoint, [10, 0]); // 原对象不变
  });
});

describe("setNodeProp（不可变设置节点静态 prop）", () => {
  it("设 display='bubble' 写入 props.display", () => {
    const next = setNodeProp(base, "P-01", "display", "bubble");
    assert.equal(next.nodes[0].props?.display, "bubble");
    assert.equal(base.nodes[0].props, undefined); // 原对象不变
  });

  it("设 tag='' 删除 props.tag 键（空 props 省字段）", () => {
    const withTag = setNodeProp(base, "P-01", "tag", "FT");
    assert.equal(withTag.nodes[0].props?.tag, "FT");
    const cleared = setNodeProp(withTag, "P-01", "tag", "");
    assert.equal(cleared.nodes[0].props?.tag, undefined);
    assert.equal(cleared.nodes[0].props, undefined, "props 清空后省字段");
  });
});

describe("moveSelectionBy（节点+边自由点整体平移，不可变）", () => {
  it("moveSelectionBy: 平移选中的自由点边", () => {
    const m0 = parseOk({ meta: { name: "t" }, interlocks: [], nodes: [],
      edges: [{ id: "e1", fromPoint: [0, 0], toPoint: [10, 0], points: [[0, 0], [10, 0]] }] });
    const m1 = moveSelectionBy(m0, [], ["e1"], 5, 7);
    assert.deepEqual(m1.edges[0].fromPoint, [5, 7]);
    assert.deepEqual(m1.edges[0].toPoint, [15, 7]);
  });

  it("moveSelectionBy: 节点端不被自由平移（仅自由点动）", () => {
    const m0 = parseOk({ meta: { name: "t" }, interlocks: [],
      nodes: [{ id: "A", type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] }],
      edges: [{ id: "e1", from: "A", toPoint: [10, 0], points: [[0, 0], [10, 0]] }] });
    const m1 = moveSelectionBy(m0, [], ["e1"], 5, 0);
    assert.equal(m1.edges[0].from, "A");        // 节点端不变
    assert.deepEqual(m1.edges[0].toPoint, [15, 0]); // 自由端平移
  });
});
