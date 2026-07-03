import type { Scene } from "../scene/scene";
import type { NodeState } from "../scene/scene";
import type { MimicEdge, MimicNode } from "../schema/schema";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";
import { tightHalfExtent, type Registry } from "./registry";
import type { HitBox, EdgePath } from "../engine/hit-test";
import { resolveDecoration } from "./state-language";
import { buildDecoration } from "./decoration";
import { sideRoute, type Side } from "../engine/edge-route";
import { contentBottomOf, layoutActionButtons, buildActionButtons, type ActionButtonBox, type ActionVisual } from "./action-buttons";

export interface RenderResult {
  readonly primitives: Primitive[];
  readonly hitBoxes: HitBox[];
  /** 设备动作按钮命中盒（世界坐标，独立于节点 hitBoxes，画布命中时优先）。 */
  readonly actionHitBoxes: ActionButtonBox[];
  /** 每条边当前实际渲染折线（auto 边为本帧重算结果）：点击选中连线的命中数据。 */
  readonly edgePaths: EdgePath[];
}

const STALE_OPACITY = 0.45;
const STALE_DASH: readonly number[] = [4, 3];

/** 失联态：主体图元整体褪色 + 描边转虚线（不可变，返回新图元）。装饰不在此处理。 */
function applyStale(prims: readonly Primitive[], faded: boolean, dashed: boolean): Primitive[] {
  if (!faded && !dashed) return [...prims];
  return prims.map((p) => {
    if (p.kind === "clip" || p.kind === "rotate" || p.kind === "scale") {
      return { ...p, children: applyStale(p.children, faded, dashed) } as Primitive;
    }
    let style = p.style;
    if (faded) style = { ...style, opacity: (style.opacity ?? 1) * STALE_OPACITY };
    if (dashed && style.stroke) style = { ...style, dash: style.dash ?? STALE_DASH };
    return { ...p, style } as Primitive;
  });
}

function edgePrimitive(
  edge: MimicEdge,
  theme: Palette,
  flowing: boolean,
  points: readonly (readonly [number, number])[],
  selected: boolean,
): Primitive {
  // 仪表引线：细虚线、低饱和、不流动（测量信号线，区别于粗工艺管线）
  if (edge.lead) {
    return { kind: "polyline", points, style: { stroke: selected ? theme.selection : theme.textMuted, strokeWidth: selected ? 2 : 1.5, dash: [3, 3], lineCap: "round" } };
  }
  return {
    kind: "polyline",
    points,
    // 平头收口：端点与设备边缘齐平，不会圆头外凸漏出设备轮廓。选中=聚焦青描色（Del 可删）。
    // 3px：管线视觉权重让位设备轮廓（设备第一可读层级）；选中加粗 4px 强调。
    style: { stroke: selected ? theme.selection : theme.stroke, strokeWidth: selected ? 4 : 3, lineCap: "butt" },
    flow: flowing,
  };
}

/**
 * 非文字图元的包围盒（= 可见本体真实范围）：连接盒/背板用它，自动贴合实际绘制的本体形体、
 * 排除标签文字、不含 bounds 里的留白（避免"管线收口到留白处、背板露画布色=间隙"）。
 * 缺省（纯文字/空）回落 undefined，调用方回落 bounds。
 */
function bodyBBox(prims: readonly Primitive[]): { x: number; y: number; w: number; h: number } | undefined {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const visit = (p: Primitive): void => {
    switch (p.kind) {
      case "text": return; // 标签/读数文字不计入本体范围
      case "rect": case "wave": case "clip": acc(p.x, p.y); acc(p.x + p.w, p.y + p.h); return;
      case "circle": acc(p.cx - p.r, p.cy - p.r); acc(p.cx + p.r, p.cy + p.r); return;
      case "line": acc(p.x1, p.y1); acc(p.x2, p.y2); return;
      case "polyline": case "polygon": for (const pt of p.points) acc(pt[0], pt[1]); return;
      case "path":
        for (const c of p.d) {
          if (c.c === "A") { acc(c.cx - c.r, c.cy - c.r); acc(c.cx + c.r, c.cy + c.r); }
          else { acc(c.x, c.y); if (c.c === "Q" || c.c === "C") acc(c.x1, c.y1); if (c.c === "C") acc(c.x2, c.y2); }
        }
        return;
      case "rotate": case "scale": for (const ch of p.children) visit(ch); return;
    }
  };
  for (const p of prims) visit(p);
  return minX <= maxX ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : undefined;
}

/**
 * 本体剪影背板：取 body 中所有「有填充」的结构形体，重渲染为不透明画布色（fill+stroke 同色，含描边占位）。
 * 背板因此**精确贴合可见本体轮廓**（圆角封头/碟形端/蜗壳…），而非 bbox 矩形——工艺管/引线收口到留白处
 * （bbox 比可见本体宽，如 exchanger 的 Q 封头控制点外溢、上下管嘴外伸）就不再露出画布色缝隙。
 * 纯线（管嘴/焊缝/连杆）、wave 液面、文字不计入：管嘴与工艺管共线无需遮，液面在本体内（被主壳剪影覆盖）。
 * 缺省（无任何填充形体）返回空，调用方回落紧致本体盒矩形（保底遮挡）。
 */
/** 解析图元是否按圆形处理：circular 可为布尔或 (node)=>boolean（如 instrument 的 box 显示模式=非圆形）。 */
function isCircular(def: { circular?: boolean | ((n: MimicNode) => boolean) }, node: MimicNode): boolean {
  return typeof def.circular === "function" ? def.circular(node) : !!def.circular;
}

function silhouetteBacking(prims: readonly Primitive[], canvas: string): Primitive[] {
  const out: Primitive[] = [];
  for (const p of prims) {
    if ((p.kind === "rect" || p.kind === "circle" || p.kind === "polygon" || p.kind === "path") && p.style.fill !== undefined) {
      const sw = p.style.strokeWidth;
      out.push({ ...p, style: sw ? { fill: canvas, stroke: canvas, strokeWidth: sw } : { fill: canvas } } as Primitive);
    } else if (p.kind === "rotate" || p.kind === "scale" || p.kind === "clip") {
      const ch = silhouetteBacking(p.children, canvas);
      if (ch.length) out.push({ ...p, children: ch } as Primitive);
    }
  }
  return out;
}

/**
 * 组合整张场景为图元 + 命中框。
 * 绘制顺序：管线 → 节点主体 → 装饰（环/角标），保证装饰在最上、管线在最下。
 */
export function renderScene(
  scene: Scene,
  registry: Registry,
  getState: (nodeId: string) => NodeState,
  isSelected: (nodeId: string) => boolean,
  theme: Palette,
  isEdgeFlowing?: (edge: MimicEdge) => boolean,
  /** 节点是否被联锁（引擎注入），点亮挂锁角标的第三态。 */
  isLocked?: (nodeId: string) => boolean,
  /** 动作按钮视觉态注入（pressed/sent 由画布/上层驱动）。缺省全部 idle。 */
  getActionVisual?: (nodeId: string, action: number | "overflow") => ActionVisual,
  /** 选中的连线（高亮 + Del 可删）。 */
  isEdgeSelected?: (edgeId: string) => boolean,
  /** 当前 viewport 缩放（透传给 symbol.build 做细节层 LOD）。 */
  scale?: number,
): RenderResult {
  const primitives: Primitive[] = [];
  const hitBoxes: HitBox[] = [];
  const actionHitBoxes: ActionButtonBox[] = [];
  const edgePaths: EdgePath[] = [];

  // 预构建每个节点的 body + 可见本体盒（非文字图元包围盒，未缩放）：连接盒/背板/主体渲染共用同一份，
  // 避免重复 build；且让 routing 与 backing 都贴合**真实绘制的本体范围**（非 bounds 留白），消除间隙。
  const nodeBody = new Map<string, { body: readonly Primitive[]; box: { x: number; y: number; w: number; h: number } }>();
  for (const node of scene.nodes) {
    const def = registry.get(node.type);
    const inlineNode = node.inline?.length ? node : { ...node, inline: [...(def.inlineFields ?? [])] };
    const body = def.build({ node: inlineNode, state: getState(node.id), theme, scale });
    nodeBody.set(node.id, { body, box: bodyBBox(body) ?? def.bounds(node) });
  }

  // 过程管线（非 lead）按两端图元实时位置重算正交轨迹（端口方位 fromSide/toSide 优先，缺省中心制）。
  // 走线连接盒 = **可见本体盒**（= 背板同一盒，非文字图元的真实包围盒）：管线/端口都收口到可见本体边、
  // 被不透明背板盖住 → **零间隙**（关键：routing 盒若含 bounds 留白，端点落留白处、背板露画布色=缝；
  // 二者必须同盒且贴合本体）。圆形用 coreRadius 真实壳体。锚点 cx/cy=node.x/y：端口跨轴/吸附以此为准。
  const connectBox = (node: typeof scene.nodes[number], def: ReturnType<typeof registry.get>) => {
    const sx = node.sizeX ?? 1;
    const sy = node.sizeY ?? 1;
    const anchor = { cx: node.x, cy: node.y };
    if (isCircular(def, node)) {
      const b = def.bounds(node);
      const r = def.coreRadius ?? Math.min(b.w, b.h) / 2;
      return { x: node.x - r * sx, y: node.y - r * sy, w: r * 2 * sx, h: r * 2 * sy, ...anchor };
    }
    const box = def.coreBox?.(node) ?? nodeBody.get(node.id)?.box ?? def.bounds(node);
    // 绕锚点按轴缩放可见本体盒（coreBox 优先：排除外凸管嘴等，线贴真实壳体收口）
    return { x: node.x - (node.x - box.x) * sx, y: node.y - (node.y - box.y) * sy, w: box.w * sx, h: box.h * sy, ...anchor };
  };
  // 端点锚：节点 → 连接盒（端口/中心，贴紧背板）；自由点 → 零尺寸点盒（中心即该点）。
  type EndAnchor = { box: { x: number; y: number; w: number; h: number; cx?: number; cy?: number }; cx: number; cy: number; circular: boolean; lrOnly: boolean; side?: MimicEdge["fromSide"] };
  const pointBox = (p: readonly [number, number]) => ({ x: p[0], y: p[1], w: 0, h: 0, cx: p[0], cy: p[1] });
  const resolveEnd = (
    nodeId: string | undefined,
    point: readonly [number, number] | undefined,
    side: MimicEdge["fromSide"],
  ): EndAnchor | undefined => {
    if (point) return { box: pointBox(point), cx: point[0], cy: point[1], circular: false, lrOnly: false };
    if (nodeId) {
      const n = scene.byId[nodeId];
      if (!n) return undefined;
      const d = registry.get(n.type);
      return { box: connectBox(n, d), cx: n.x, cy: n.y, circular: isCircular(d, n), lrOnly: !!d.lrOnly, side };
    }
    return undefined;
  };
  const autoPointsOf = (edge: MimicEdge): readonly (readonly [number, number])[] | undefined => {
    const A = resolveEnd(edge.from, edge.fromPoint, edge.fromSide);
    const B = resolveEnd(edge.to, edge.toPoint, edge.toSide);
    if (!A || !B) return undefined;
    if (edge.lead) {
      // 折线引线用标准正交连接器（sideRoute：从指定边端口 perpendicular 出线 + 正交中段）。
      // **优先尊重用户连线时定的出/入边**（A.side/B.side = edge.fromSide/toSide）——两点（含各自连哪条边）一旦定了，
      // 就按这两个连接点布线、绝不每帧重算，否则挪动一端会让线"改从另一条边出"（用户实拍：明明连阀顶部却像从阀左边出）。
      // 仅当某端**没存边**（老数据/自由点）才按相对位置自动选边（带迟滞消抖）。
      let fs: Side | undefined = A.side;
      let ts: Side | undefined = B.side;
      const needAuto = (!fs && !edge.fromPoint) || (!ts && !edge.toPoint);
      if (needAuto) {
        // 引线（虚线）= 关联关系，可连元件任意边，**不受 lrOnly 约束**（连阀/泵也能从顶/底进）。
        // 选边（aH/bH = 该端是否走水平边 L/R）：对着就直连、斜对单折 L。
        const dx = B.cx - A.cx, dy = B.cy - A.cy;
        const yOv = Math.max(A.box.y, B.box.y) <= Math.min(A.box.y + A.box.h, B.box.y + B.box.h); // 左右对着
        const xOv = Math.max(A.box.x, B.box.x) <= Math.min(A.box.x + A.box.w, B.box.x + B.box.w); // 上下对着
        let aH: boolean, bH: boolean;
        if (yOv) { aH = true; bH = true; }       // 左右对着 → 都走 L/R = 直线
        else if (xOv) { aH = false; bH = false; } // 上下对着 → 都走 T/B = 直线（上方仪表→阀顶，直连无折）
        else { const horiz = Math.abs(dx) >= Math.abs(dy); aH = horiz; bH = !horiz; } // 斜对：一横一纵单折 L
        if (!fs) fs = aH ? (dx >= 0 ? "R" : "L") : (dy >= 0 ? "B" : "T");
        if (!ts) ts = bH ? (dx >= 0 ? "L" : "R") : (dy >= 0 ? "T" : "B");
      }
      // 引线与实线一律**固定端口**：端点钉在元件边中点不动，线随相对位置折（L/Z）。
      // 仅 fromPoint/toPoint（库里拖出的独立虚线，自由点）才传 undefined → 端点落在自由坐标、可拖任意处。
      return sideRoute(A.box, B.box, edge.fromPoint ? undefined : fs, edge.toPoint ? undefined : ts);
    }
    // 工艺管线：固定端口——点位绝不随对端移动；自由点端无「边」→ 不传 side（零尺寸盒走中心制）。
    return sideRoute(A.box, B.box, A.circular ? undefined : A.side, B.circular ? undefined : B.side);
  };
  // 仪表引线收集后单独压栈（在背板之后、设备主体之前）：被**真实本体轮廓**收口而非矩形背板，
  // 贴合圆角本体（卧罐碟形端/管嘴外伸处）零间隙；工艺管线仍在背板之下保留下穿遮挡。
  const leadPrims: Primitive[] = [];
  for (const edge of scene.edges) {
    const points = autoPointsOf(edge) ?? edge.points.map(([x, y]) => [x, y] as const);
    edgePaths.push({ id: edge.id, points });
    const prim = edgePrimitive(edge, theme, isEdgeFlowing ? isEdgeFlowing(edge) : false, points, isEdgeSelected?.(edge.id) ?? false);
    if (edge.lead) leadPrims.push(prim);
    else primitives.push(prim);
  }

  const backings: Primitive[] = []; // 不透明背板（统一在引线之前压栈）
  const bodies: Primitive[] = []; // 非标注设备主体（统一在引线之后压栈，盖住伸入本体的引线端）
  const decorations: Primitive[] = [];
  const overlayPrims: Primitive[] = []; // 标注层（readout 等）：最后压栈，盖在所有设备+装饰之上
  const overlayHitBoxes: HitBox[] = []; // 标注层命中框：循环后追加到 hitBoxes 末尾，使其命中优先级与视觉一致（盖在上面=先被选中）
  for (const node of scene.nodes) {
    const def = registry.get(node.type);
    const isOverlay = !!def.overlay;
    const circular = isCircular(def, node); // 按 node 解析（instrument box 模式非圆形）
    // 标注层的主体与装饰都进 overlayPrims；其余设备主体进 bodies（引线之后压栈）。
    const bodyTarget = isOverlay ? overlayPrims : bodies;
    const decoTarget = isOverlay ? overlayPrims : decorations;
    const state = getState(node.id);
    const decoRaw = resolveDecoration(state, isSelected(node.id), isLocked ? isLocked(node.id) : false);
    // noFade 元件（terminal 等）：去掉未配置/失联的褪色虚线 + ? 角标（很少接 MQTT，虚化无意义）。
    const deco = def.noFade
      ? { ...decoRaw, faded: false, dashed: false, badge: decoRaw.badge === "stale" ? "none" as const : decoRaw.badge }
      : decoRaw;
    const b = def.bounds(node);
    // 缩放（分轴）：绕节点中心放大/缩小/拉伸命中框（解析算，与 scale 变换原语一致），主体/背板裹进 scale 组。
    const sizeX = node.sizeX ?? 1;
    const sizeY = node.sizeY ?? 1;
    const scaled = sizeX !== 1 || sizeY !== 1;
    const scaleBox = (box: { x: number; y: number; w: number; h: number }) =>
      scaled
        ? { x: node.x - (node.x - box.x) * sizeX, y: node.y - (node.y - box.y) * sizeY, w: box.w * sizeX, h: box.h * sizeY }
        : box;
    const sb = scaleBox(b);
    // 精确「贴主体」盒（coreBox，若 symbol 定义了）：选中环/动作按钮优先用它——不少 symbol 的 bounds
    // 故意为下方标签/内联文字多留几十像素命中空间（如 condenser），直接用 bounds 会显得环/按钮飘在
    // 图形外一大截。未定义 coreBox 的 symbol（bounds 本身就是真实轮廓，如 vessel/cyclone 的长尾结构）
    // 不受影响，继续走原逻辑。
    const coreB = def.coreBox?.(node);
    const scb = coreB ? scaleBox(coreB) : undefined;
    const scaleWrap = (prims: readonly Primitive[]): readonly Primitive[] =>
      scaled ? [{ kind: "scale", cx: node.x, cy: node.y, sx: sizeX, sy: sizeY, children: prims }] : prims;
    // 不透明背板（画布底色）：垫在主体之下，把下穿管线 / 连线端头藏住 —— 连线收口贴齐、且主体
    // 半透明（失联/未配置褪色）时管线不从身体里透出。圆形用内切圆背板（半径取 coreRadius 真实壳体）。
    // 非圆形用**可见本体盒**（= connectBox 同一盒：非文字图元真实包围盒）：精确贴合本体——既不外溢遮
    // 邻居标签、也不缩进露出管线端头（间隙）。标注层不画背板（自身盒即背景，且需透出被标记的组件）。
    if (!isOverlay) {
      // 圆形用内切圆背板；非圆形用**本体剪影**（贴合可见轮廓，消除 bbox 留白处的画布色缝）；
      // 剪影为空（纯线/无填充图元）回落紧致本体盒矩形保底遮挡。
      const rawBody = nodeBody.get(node.id)?.body;
      const sil = !circular && rawBody ? silhouetteBacking(rawBody, theme.canvas) : [];
      const bodyBox = nodeBody.get(node.id)?.box ?? b;
      const backingPrims: readonly Primitive[] = circular
        ? [{ kind: "circle", cx: node.x, cy: node.y, r: def.coreRadius ?? Math.min(b.w, b.h) / 2, style: { fill: theme.canvas } }]
        : sil.length
          ? sil
          : [{ kind: "rect", x: bodyBox.x, y: bodyBox.y, w: bodyBox.w, h: bodyBox.h, style: { fill: theme.canvas } }];
      backings.push(
        ...scaleWrap(
          node.rotation && !circular
            ? [{ kind: "rotate", cx: node.x, cy: node.y, deg: node.rotation, children: backingPrims }]
            : backingPrims,
        ),
      );
    }
    // 主体图元：复用预构建的 body（连接盒/背板已用其包围盒，避免重复 build）。
    // node.rotation 非 0 时只旋转几何形状，文字（位号/内联值）保持正向可读——否则旋转 90/180° 的
    // 图元（如朝向端子）标签会侧倒/翻转。inlineNode 回落逻辑已在预构建阶段统一应用。
    const body = nodeBody.get(node.id)?.body ?? def.build({ node, state, theme, scale });
    const oriented: readonly Primitive[] = node.rotation
      ? [
          { kind: "rotate", cx: node.x, cy: node.y, deg: node.rotation, children: body.filter((p) => p.kind !== "text") },
          ...body.filter((p) => p.kind === "text"),
        ]
      : body;
    bodyTarget.push(...applyStale(scaleWrap(oriented), deco.faded, deco.dashed));
    // 装饰环外接圆半径：有 coreBox 用真实图形盒——circular 元件（如 motor）的 bounds 同样可能含文字
    // 预留虚高，若按 bounds 算 r，选中/报警圆环会比可见机身大一圈。
    const rBox = scb ?? sb;
    const r = Math.max(rBox.w, rBox.h) / 2;
    // 标注层(overlay)命中框进 overlayHitBoxes，循环后追加到末尾 → hitTest 从尾往前先撞到它，
    // 命中优先级与视觉 z 序一致（overlay 盖在大节点如精馏塔上，点它就该选中它而非底下的塔）。
    (isOverlay ? overlayHitBoxes : hitBoxes).push({
      id: node.id,
      x: sb.x,
      y: sb.y,
      w: sb.w,
      h: sb.h,
      cx: node.x,
      cy: node.y,
      ...(node.rotation ? { rotation: node.rotation } : {}),
      ...(circular ? { circle: { cx: node.x, cy: node.y, r: Math.min(sb.w, sb.h) / 2 } } : {}),
      ...(def.lrOnly ? { lrOnly: true } : {}),
    });
    // 选中/报警/联锁环 + 角标贴合主体：有精确 coreBox 用它；否则回落紧致对称近似（与拉伸框手柄同一
    // 公式）。两者都是为了不让环画得比可见轮廓大一圈、飘在元件外。环纯装饰、不承载文本定位语义。
    const decoBox = circular
      ? undefined
      : scb ?? {
          x: node.x - tightHalfExtent(node.x, b.x, b.x + b.w) * sizeX,
          y: node.y - tightHalfExtent(node.y, b.y, b.y + b.h) * sizeY,
          w: tightHalfExtent(node.x, b.x, b.x + b.w) * sizeX * 2,
          h: tightHalfExtent(node.y, b.y, b.y + b.h) * sizeY * 2,
        };
    decoTarget.push(...buildDecoration(deco, { cx: node.x, cy: node.y, r, ...(decoBox ? { box: decoBox } : {}) }, theme));
    // 动作按钮：停靠设备下方的胶囊（按 UI 处理，不随失联褪色——applyStale 只作用于主体）。
    if (node.actions?.length) {
      // 按钮锚点 = 实际内容底：图形底（coreBox 优先，排除 bounds 里为文字多留的命中空间，如
      // condenser 的 +40）与下方位号/内联文字最低点取大者。contentBottomOf 扫真实 body 图元——
      // tank 位号在拱顶上方/值在罐内会自动退回图形底，无需旗子；比「常量假设文字占位」精确，
      // 否则各 symbol 手调的 belowY（图形底 +12~16 不等）让按钮离内容忽近忽远。
      const refBox = coreB ?? b;
      const local = contentBottomOf(body, refBox.y + refBox.h);
      const anchorY = node.y + (local - node.y) * sizeY; // 与 scaleWrap 同一缩放模型（绕节点中心）
      const boxes = layoutActionButtons(node, anchorY, sizeY);
      actionHitBoxes.push(...boxes);
      decoTarget.push(...buildActionButtons(boxes, theme, (box) => getActionVisual?.(box.nodeId, box.action) ?? "idle", sizeY));
    }
  }

  // 叠加顺序：工艺管线 → 背板 → 仪表引线 → 设备主体 → 装饰（环/角标）→ 标注层（readout 贴在最上）。
  // 引线夹在背板与主体之间：被真实本体轮廓收口（贴合圆角本体零间隙），起点也被仪表圆盖住。
  primitives.push(...backings, ...leadPrims, ...bodies, ...decorations, ...overlayPrims);
  hitBoxes.push(...overlayHitBoxes); // 标注层命中框追加到末尾 → 命中优先级最高（与 overlayPrims 最后绘制对应）

  return { primitives, hitBoxes, actionHitBoxes, edgePaths };
}
