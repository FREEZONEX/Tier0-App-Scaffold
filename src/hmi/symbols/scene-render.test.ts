import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderScene } from "./scene-render";
import { createRegistry } from "./registry";
import { tank } from "./tank";
import { pump } from "./pump";
import { motor } from "./motor";
import { readout } from "./readout";
import { getPalette } from "../engine/theme";
import { buildScene } from "../scene/scene";
import { parseMimic } from "../schema/schema";

const reg = createRegistry([tank, pump]);
const theme = getPalette("light");
const scene = buildScene(parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} },
    { id: "P-01", type: "pump", x: 300, y: 100, topics: [], bindings: {} },
  ],
  edges: [{ id: "e1", from: "TK-01", to: "P-01", points: [[132, 100], [278, 100]] }],
}).data!);

const idleState = () => ({ values: {}, running: false, fault: false, stale: false });

describe("renderScene", () => {
  it("产出图元 + 命中框（每节点一框）", () => {
    const r = renderScene(scene, reg, idleState, () => false, theme);
    assert.ok(r.primitives.length > 0);
    assert.equal(r.hitBoxes.length, 2);
    assert.deepEqual(r.hitBoxes.map((b) => b.id).sort(), ["P-01", "TK-01"]);
  });
  it("选中节点产出选中环", () => {
    const r = renderScene(scene, reg, idleState, (id) => id === "P-01", theme);
    // 选中环是描边 selection 色的 circle
    assert.ok(r.primitives.some((p) => p.kind === "circle" && (p as { style: { stroke?: string } }).style.stroke === theme.selection));
  });
  it("有流的边产出 flow polyline", () => {
    const r = renderScene(scene, reg, idleState, () => false, theme, () => true);
    assert.ok(r.primitives.some((p) => p.kind === "polyline" && (p as { flow?: boolean }).flow === true));
  });
  // 视觉层级：工艺管线 3px（轻于设备轮廓的视觉权重），选中加粗到 4px 强调
  it("工艺管线未选中 3px、选中 4px（选中=聚焦青）", () => {
    const plain = renderScene(scene, reg, idleState, () => false, theme);
    const e1 = plain.primitives.find((p) => p.kind === "polyline") as { style: { strokeWidth?: number; stroke?: string } };
    assert.equal(e1.style.strokeWidth, 3);
    assert.equal(e1.style.stroke, theme.stroke);
    const sel = renderScene(scene, reg, idleState, () => false, theme, undefined, undefined, undefined, (id) => id === "e1");
    const e2 = sel.primitives.find((p) => p.kind === "polyline") as { style: { strokeWidth?: number; stroke?: string } };
    assert.equal(e2.style.strokeWidth, 4);
    assert.equal(e2.style.stroke, theme.selection);
  });
  it("仪表引线 lead 边：细虚线、低饱和、不流动", () => {
    const leadScene = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [
        { id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} },
        { id: "G", type: "dialgauge", x: 200, y: 100, topics: [], bindings: {} },
      ],
      edges: [{ id: "lead1", from: "G", to: "TK-01", points: [[180, 100], [120, 100]], lead: true }],
    }).data!);
    const r = renderScene(leadScene, reg, idleState, () => false, theme, () => true);
    const lead = r.primitives.find((p) => p.kind === "polyline" && (p as { style: { stroke?: string } }).style.stroke === theme.textMuted);
    assert.ok(lead, "应有低饱和引线");
    assert.ok((lead as { style: { dash?: readonly number[] } }).style.dash !== undefined, "引线应为虚线");
    assert.equal((lead as { flow?: boolean }).flow, undefined, "引线不应流动");
    // 新铁律：引线端点也钉死在元件边中点（不浮动）。仪表(G@200,100)与设备(TK@100,100)同高
    // → 两端口同 y → 视觉水平直线（可含贴边内缩/冗余共线点，不强求 2 个点）。
    const lp = r.edgePaths.find((p) => p.id === "lead1");
    assert.ok(lp && lp.points.length >= 2, "引线应有折线点");
    assert.ok(lp!.points.every((p) => p[1] === lp!.points[0][1]), "两端同高 → 所有点同 y = 水平直线（连到设备对应高度）");
  });
  it("标注层(readout)命中框排在末尾 → 盖在大节点上时优先选中（命中 z 序=视觉 z 序）", () => {
    const regRO = createRegistry([tank, readout]);
    // readout 节点排在前、tank 在后，且坐标重叠：若命中框按节点顺序，tank 会排末尾抢走点击。
    const overlapScene = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [
        { id: "RO-01", type: "readout", x: 100, y: 100, topics: [], bindings: {} },
        { id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} },
      ],
      edges: [],
    }).data!);
    const r = renderScene(overlapScene, regRO, idleState, () => false, theme);
    // hitTest 从数组尾往前找顶层 → 末尾必须是 overlay 的 readout，点重叠处才选中它而非底下的 tank
    assert.equal(r.hitBoxes[r.hitBoxes.length - 1].id, "RO-01", "readout 命中框应排在末尾（优先命中）");
  });
  it("失联节点：主体图元被褪色 + 描边虚线（角标保持清晰）", () => {
    const staleState = () => ({ values: {}, running: false, fault: false, stale: true });
    const r = renderScene(scene, reg, staleState, () => false, theme);
    // 主体图元出现降低的 opacity
    const faded = r.primitives.filter(
      (p) => (p as { style: { opacity?: number } }).style.opacity !== undefined &&
        (p as { style: { opacity?: number } }).style.opacity! < 1,
    );
    assert.ok(faded.length > 0, "expected some faded primitives");
    // 至少一个带描边的主体图元被加上 dash
    const dashed = r.primitives.filter(
      (p) => (p as { style: { dash?: readonly number[] } }).style.dash !== undefined,
    );
    assert.ok(dashed.length > 0, "expected some dashed primitives");
  });
  it("isLocked 注入：点亮联锁挂锁角标", () => {
    const r = renderScene(scene, reg, idleState, () => false, theme, undefined, (id) => id === "P-01");
    // 挂锁角标用 interlock 琥珀色填充或描边
    assert.ok(r.primitives.some((p) =>
      (p as { style: { fill?: string; stroke?: string } }).style.fill === theme.interlock ||
      (p as { style: { fill?: string; stroke?: string } }).style.stroke === theme.interlock));
  });
  it("auto 边：按两端图元实时位置重算轨迹（移动节点线跟随）", () => {
    const mk = (x: number, y: number) => buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [
        { id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} },
        { id: "P-01", type: "pump", x, y, topics: [], bindings: {} },
      ],
      // 存储 points 是过期快照 —— auto 边渲染时应忽略它
      edges: [{ id: "e1", from: "TK-01", to: "P-01", auto: true, points: [[0, 0], [1, 1]] }],
    }).data!);
    const pointsOfFirstPolyline = (s: ReturnType<typeof mk>) => {
      const r = renderScene(s, reg, idleState, () => false, theme);
      const line = r.primitives.find((p) => p.kind === "polyline") as { points: readonly (readonly [number, number])[] };
      return line.points;
    };
    const near = (v: number, t: number) => Math.abs(v - t) < 30; // 端点=bounds 几何中心，离节点坐标 < 半个图元
    const a = pointsOfFirstPolyline(mk(300, 100));
    // 忽略过期快照 [[0,0],[1,1]]，端点落在两图元身上（藏于背板下）
    assert.ok(near(a[0][0], 100) && near(a[0][1], 100), `首点应在 TK-01 上，实际 ${a[0]}`);
    assert.ok(near(a[a.length - 1][0], 300) && near(a[a.length - 1][1], 100), `末点应在 P-01 上，实际 ${a[a.length - 1]}`);
    // 移动 P-01 → 轨迹重算
    const b = pointsOfFirstPolyline(mk(300, 400));
    assert.ok(near(b[b.length - 1][1], 400), `移动后末点应跟到新位置，实际 ${b[b.length - 1]}`);
    assert.notDeepEqual(a, b);
  });

  it("节点主体下垫画布底色背板：失联半透明时管线不从图元下透出", () => {
    const staleState = () => ({ values: {}, running: false, fault: false, stale: true });
    const r = renderScene(scene, reg, staleState, () => false, theme);
    // 每节点一块 fill=canvas 的背板（tank 矩形、pump 圆形），且不受失联褪色影响（无 opacity）
    const backings = r.primitives.filter((p) => {
      const fill = (p as { style?: { fill?: string; opacity?: number } }).style?.fill;
      const opacity = (p as { style?: { opacity?: number } }).style?.opacity;
      return fill === theme.canvas && opacity === undefined && (p.kind === "rect" || p.kind === "circle");
    });
    assert.equal(backings.length, 2, "每节点一块不透明背板");
    assert.ok(backings.some((p) => p.kind === "rect"), "矩形图元用矩形背板");
    assert.ok(backings.some((p) => p.kind === "circle"), "圆形图元用圆形背板");
    // 泵背板齐壳体半径（coreRadius=15），非 bounds 内切圆(~26)——否则壳体外留环形缝、连线收不齐
    const pumpBacking = backings.find((p) => p.kind === "circle") as { cx: number; r: number };
    assert.equal(pumpBacking.cx, 300, "泵背板圆心=节点");
    assert.equal(pumpBacking.r, 15, "泵背板半径=蜗壳壳体 R，贴轮廓收口");
    // 背板在管线之后、主体之前（遮线不遮体）
    const firstBacking = r.primitives.findIndex((p) => (p as { style?: { fill?: string } }).style?.fill === theme.canvas);
    const lastEdge = r.primitives.findIndex((p) => p.kind === "polyline");
    assert.ok(firstBacking > lastEdge, "背板叠在管线之上");
  });

  it("圆形图元两端：忽略 fromSide/toSide 按中心走线（不甩 SIDE_STUB 出背板，无 stray）", () => {
    const reg2 = createRegistry([pump, motor]);
    const s = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [
        { id: "pump-1", type: "pump", x: 140, y: 100, topics: [], bindings: {} },
        { id: "motor-1", type: "motor", x: 165, y: 365, topics: [], bindings: {} },
      ],
      // 即便存了 R/L 侧（拖拽落在 motor 左侧），圆形也应改走中心，不绕到左边甩出线头
      edges: [{ id: "e", from: "pump-1", to: "motor-1", points: [[140, 100], [165, 365]], fromSide: "R", toSide: "L" }],
    }).data!);
    const r = renderScene(s, reg2, idleState, () => false, theme);
    const path = r.edgePaths[0].points;
    // 中心制 L 形：pump 中心(140,100) → 下到 motor.y → 右到 motor 中心(165,365)。无任何点甩到 motor 左侧(x<140)。
    assert.deepEqual(path.map((p) => [p[0], p[1]]), [[140, 100], [140, 365], [165, 365]]);
    assert.ok(!path.some((p) => p[0] < 140), "不应有点甩到 pump 列左侧（旧 SIDE_STUB stray）");
  });

  it("node.rotation 非 0：主体被 rotate 组包裹，hitbox 带 rotation", () => {
    const rotScene = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "TK-01", type: "tank", x: 100, y: 100, rotation: 90, topics: [], bindings: {} }],
      edges: [],
    }).data!);
    const r = renderScene(rotScene, reg, idleState, () => false, theme);
    assert.ok(r.primitives.some((p) => p.kind === "rotate" && (p as { deg: number }).deg === 90));
    assert.equal(r.hitBoxes[0].rotation, 90);
  });
  it("node.sizeX/sizeY 非 1：主体被 scale 组分轴包裹，hitbox 绕中心分轴缩放（支持拉伸）", () => {
    const sizedScene = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "TK-01", type: "tank", x: 100, y: 100, sizeX: 2, sizeY: 0.5, topics: [], bindings: {} }],
      edges: [],
    }).data!);
    const base = renderScene(scene, reg, idleState, () => false, theme).hitBoxes.find((b) => b.id === "TK-01")!;
    const r = renderScene(sizedScene, reg, idleState, () => false, theme);
    assert.ok(r.primitives.some((p) => p.kind === "scale" && (p as { sx: number; sy: number }).sx === 2 && (p as { sy: number }).sy === 0.5));
    const hb = r.hitBoxes[0];
    assert.equal(hb.w, base.w * 2);
    assert.equal(hb.h, base.h * 0.5);
    // 绕节点锚点(100,100)分轴缩放：到锚点的距离按各轴倍率缩放（锚点为不动点）
    assert.equal(100 - hb.x, (100 - base.x) * 2);
    assert.equal(100 - hb.y, (100 - base.y) * 0.5);
  });
  it("旋转图元：文字（位号/值）不随几何旋转，提到 rotate 组外保持正向可读", () => {
    const rotScene = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "TK-01", type: "tank", x: 100, y: 100, rotation: 90, label: "TK-01", topics: [], bindings: {} }],
      edges: [],
    }).data!);
    const r = renderScene(rotScene, reg, idleState, () => false, theme);
    const rot = r.primitives.find((p) => p.kind === "rotate" && (p as { deg: number }).deg === 90) as { children: { kind: string }[] } | undefined;
    assert.ok(rot, "几何应被 rotate 组包裹");
    assert.ok(!rot!.children.some((c) => c.kind === "text"), "旋转组内不应含文字（文字已提到组外）");
    assert.ok(r.primitives.some((p) => p.kind === "text"), "顶层应存在正向文字位号");
  });
  it("overlay 元件（readout）渲染到最上层、且不画不透明背板（贴在组件上做标记）", () => {
    const reg2 = createRegistry([tank, readout]);
    // readout 排在前、tank 排在后；同位置叠放
    const s = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [
        { id: "RD", type: "readout", x: 50, y: 50, topics: [], bindings: {} },
        { id: "TK", type: "tank", x: 50, y: 50, topics: [], bindings: {} },
      ],
      edges: [],
    }).data!);
    const r = renderScene(s, reg2, idleState, () => false, theme);
    // 标注层在最上：readout 的占位文本 "--" 应出现在 tank 本体（fillLight rect）之后
    const tankBodyIdx = r.primitives.findIndex((p) => p.kind === "rect" && (p as { style: { fill?: string } }).style.fill === theme.fillLight);
    const readoutTextIdx = r.primitives.findIndex((p) => p.kind === "text" && (p as { text: string }).text === "--");
    assert.ok(tankBodyIdx >= 0 && readoutTextIdx > tankBodyIdx, "readout 标注应渲染在设备主体之后（最上层）");
    // readout 无不透明背板：canvas 底色填充的 rect 只应来自 tank 这一个背板
    const backings = r.primitives.filter((p) => p.kind === "rect" && (p as { style: { fill?: string } }).style.fill === theme.canvas);
    assert.equal(backings.length, 1, "仅 tank 有 canvas 背板，readout 不应有");
  });
  it("node.inline 为空：回落该类型默认 inlineFields，仍在下方显示主实时值", () => {
    // 场景里的 P-01（pump）解析自最小 schema → inline=[]。pump.inlineFields=["rpm"]。
    const withRpm = (id: string) => ({ values: id === "P-01" ? { rpm: 90 } : {}, running: false, fault: false, stale: false });
    const r = renderScene(scene, reg, withRpm, () => false, theme);
    const texts = r.primitives.filter((p) => p.kind === "text").map((p) => (p as { text: string }).text);
    assert.ok(texts.some((t) => /90/.test(t)), `应回落 inlineFields 显示 rpm 值，实得文本 ${JSON.stringify(texts)}`);
  });

  it("node.rotation 为 0：不包裹 rotate（无额外开销）", () => {
    const r = renderScene(scene, reg, idleState, () => false, theme);
    assert.ok(!r.primitives.some((p) => p.kind === "rotate"));
    assert.equal(r.hitBoxes[0].rotation, undefined);
  });
});

describe("动作按钮渲染", () => {
  const actionScene = buildScene(parseMimic({
    meta: { name: "x", version: 1 },
    nodes: [
      { id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} },
      { id: "P-01", type: "pump", x: 300, y: 100, topics: [], bindings: {}, actions: [{ label: "启动", items: [{ topic: "t", template: "{}" }] }] },
    ],
    edges: [],
  }).data!);

  it("带 actions 的节点输出 actionHitBoxes；无 actions 不输出", () => {
    const r = renderScene(actionScene, reg, idleState, () => false, theme);
    assert.equal(r.actionHitBoxes.length, 1, "单动作 → 单盒（无 ⋯）");
    assert.equal(r.actionHitBoxes[0].nodeId, "P-01");
    assert.equal(r.actionHitBoxes[0].action, 0);
    assert.ok(r.actionHitBoxes.every((b) => b.nodeId !== "TK-01"), "无 actions 的节点不产生盒");
  });

  it("失联节点的按钮不被虚化（按钮是 UI 不是设备状态）", () => {
    const staleState = () => ({ values: {}, running: false, fault: false, stale: true });
    const r = renderScene(actionScene, reg, staleState, () => false, theme);
    assert.equal(r.actionHitBoxes.length, 1, "失联仍有按钮命中盒");
    const box = r.actionHitBoxes[0];
    // 按命中盒几何在 primitives 中找按钮 rect（buildActionButtons 的 rect 与盒同坐标尺寸）
    const btnRect = r.primitives.find(
      (p) => p.kind === "rect" && p.x === box.x && p.y === box.y && p.w === box.w && p.h === box.h,
    ) as { style: { opacity?: number } } | undefined;
    assert.ok(btnRect, "应有与命中盒同几何的按钮 rect");
    assert.equal(btnRect!.style.opacity, undefined, "按钮 opacity 不被乘 STALE_OPACITY");
  });
});

describe("自由端点边渲染", () => {
  it("renderScene: node→自由点 工艺线 收口到自由点（非快照坐标）", () => {
    // TK-01 在 (100,100)，自由点在 (300,100)。
    // points 快照故意设为陈旧值 [[0,0],[999,999]]（节点已移动），
    // stopgap（autoPointsOf 返回 undefined → 回落 points 快照）则末点 = 999。
    // 新代码（感知 toPoint）应路由到自由点 (300,100)，末点 x=300。
    const s = buildScene(parseMimic({
      meta: { name: "t", version: 1 },
      nodes: [{ id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} }],
      edges: [{ id: "e1", from: "TK-01", toPoint: [300, 100], points: [[0, 0], [999, 999]] }],
    }).data!);
    const r = renderScene(s, reg, idleState, () => false, theme);
    const path = r.edgePaths.find((p) => p.id === "e1")!;
    assert.ok(path, "应有 e1 edgePath");
    const last = path.points[path.points.length - 1];
    // stopgap 下末点为 999（陈旧快照），新代码路由到 toPoint → 末点 x=300
    assert.deepEqual([Math.round(last[0]), Math.round(last[1])], [300, 100], `末点应落到自由点 (300,100)，实际 ${JSON.stringify(last)}`);
  });

  it("renderScene: 自由点→自由点 直接两点正交连（非快照坐标）", () => {
    // fromPoint(0,0) → toPoint(100,100)，快照故意设为 [[500,500],[600,600]]（陈旧）。
    // stopgap 回落快照 → 首点 500；新代码感知自由点 → 首点 0，末点 100。
    const s = buildScene(parseMimic({
      meta: { name: "t", version: 1 },
      nodes: [],
      edges: [{ id: "e1", fromPoint: [0, 0], toPoint: [100, 100], points: [[500, 500], [600, 600]] }],
    }).data!);
    const r = renderScene(s, reg, idleState, () => false, theme);
    const path = r.edgePaths.find((p) => p.id === "e1")!;
    assert.ok(path, "应有 e1 edgePath");
    // stopgap 下首点 x=500（陈旧快照），新代码 → 首点 x=0
    assert.equal(path.points[0][0], 0, `首点 x 应为 0（fromPoint），实际 ${path.points[0][0]}`);
    assert.equal(path.points[0][1], 0, `首点 y 应为 0（fromPoint），实际 ${path.points[0][1]}`);
    // 末点应落到 toPoint (100,100)
    assert.equal(path.points[path.points.length - 1][0], 100, `末点 x 应为 100，实际 ${path.points[path.points.length - 1][0]}`);
    assert.equal(path.points[path.points.length - 1][1], 100, `末点 y 应为 100，实际 ${path.points[path.points.length - 1][1]}`);
  });
});
