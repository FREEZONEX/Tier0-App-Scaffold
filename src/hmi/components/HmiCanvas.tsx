"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Maximize2, Plus, Minus } from "lucide-react";
import { PALETTE_MIME, PALETTE_LINE_MIME } from "./Palette";
import type { CanvasTool } from "./EditToolbar";
import { createCanvasStage, type CanvasStage } from "@/hmi/engine/canvas-stage";
import { createRenderLoop, type RenderLoop } from "@/hmi/engine/render-loop";
import { createViewport, fit, zoomAt, panBy, clampScale, toWorld, toScreen, type Viewport } from "@/hmi/engine/viewport";
import { hitTest, hitTestEdges, edgesInMarquee, type HitBox, type EdgePath } from "@/hmi/engine/hit-test";
import { portsOf, portOf, centerRoute, sideRoute, nearestSide, type Side } from "@/hmi/engine/edge-route";
import { renderScene } from "@/hmi/symbols/scene-render";
import { useT } from "@/hmi/i18n/context";
import { hitTestActionButtons, type ActionButtonBox } from "@/hmi/symbols/action-buttons";
import { sceneBounds } from "@/hmi/scene/scene-bounds";
import type { Scene, NodeState } from "@/hmi/scene/scene";
import type { MimicEdge } from "@/hmi/schema/schema";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette } from "@/hmi/engine/theme";

export interface HmiCanvasProps {
  scene: Scene;
  registry: Registry;
  palette: Palette;
  getState: (nodeId: string) => NodeState;
  /** 当前选中的节点 id 集合（单选=1 个，框选=多个）。驱动高亮与整组拖拽。 */
  selectedIds: readonly string[];
  isEdgeFlowing: (edge: MimicEdge) => boolean;
  hasAnimation: () => boolean;
  /** 注册数据变化监听（如 tagStore.subscribe），返回取消函数。变化时触发重绘。 */
  subscribeData: (listener: () => void) => () => void;
  /** 单选：点击节点选中、点击空白传 null 清空。 */
  onSelect: (nodeId: string | null) => void;
  /** 框选：拖出选框后传命中的节点 id 集合（替换当前选择）。 */
  onSelectMany: (nodeIds: string[]) => void;
  /** 框选时同步选中的连线 id 集合（与 onSelectMany 同一拖拽松手触发）。 */
  onSelectManyEdges?: (edgeIds: string[]) => void;
  /**
   * 拖拽选区：传世界坐标增量(dx,dy) 及节点/连线 id 集合，由上层通过 moveSelectionBy 落库。
   * 拖动选中节点时 nodeIds 为整个选择集；同步移动 edgeIds 中的自由点边。
   */
  onSelectionDrag?: (nodeIds: readonly string[], edgeIds: readonly string[], dx: number, dy: number) => void;
  /** 选区拖拽起点（首次移动时触发一次）：供上层把整段拖拽合并为一步历史。 */
  onNodesDragStart?: () => void;
  /** 拉伸缩放：单选时拖四角手柄，传该节点的横/纵缩放倍率(sizeX,sizeY)。缺省时不显手柄。 */
  onResizeNode?: (nodeId: string, sizeX: number, sizeY: number) => void;
  /** 画布工具：pan=拖动平移（默认，拖节点也只平移防误挪）、select=拖节点移动/拖空白框选、line=画线连边。Shift+拖在各工具下都框选。 */
  tool?: CanvasTool;
  /** 拖放/点选新建：传图元 type 与世界坐标。 */
  onAddNode?: (type: string, x: number, y: number) => void;
  /** 拖放/点选新建自由点线段：传线种类与世界坐标（线段以该点为中心，长 120px）。 */
  onPlaceLine?: (kind: "pipe" | "lead", x: number, y: number) => void;
  /** 画线完成：from→to 与世界坐标折线点（含两端锚点）。缺省时画线工具不可用。 */
  onAddEdge?: (from: string, to: string, points: [number, number][], sides?: { fromSide?: Side; toSide?: Side }) => void;
  /** 画线落空白：从 fromId 端口拖出、松手在非节点处 → node→自由点边（fromSide=起手方位，point=世界落点）。 */
  onAddEdgePoint?: (fromId: string, fromSide: Side, point: [number, number]) => void;
  /** 选中的连线 id 集合（编辑态点击连线选中，高亮 + Del 删除；多选由上层 marquee 填充）。 */
  selectedEdgeIds?: readonly string[];
  /** 点击连线选中 / 点空白与节点时清除（仅编辑态传入）。 */
  onSelectEdge?: (edgeId: string | null) => void;
  /**
   * 拖拽连线端点手柄（编辑态，选中单条边时显示）。
   * commit=false：拖拽中实时更新（history.replace 合并）；commit=true：松手最终落点（锚定/解锚）。
   */
  onSetEdgeEnd?: (
    edgeId: string,
    which: "from" | "to",
    end: { node?: string; point?: [number, number]; side?: "L" | "R" | "T" | "B" },
    commit: boolean,
  ) => void;
  /** 联锁：节点是否被锁（点亮挂锁角标）。 */
  isLocked?: (nodeId: string) => boolean;
  /** 非动画输入（选中/联锁签名）变化时的重绘触发键。 */
  redrawKey?: string;
  /** 键盘事件（方向键在节点间移动选择、Escape 取消等，逻辑在 HmiPage）。 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLCanvasElement>) => void;
  /** Esc 取消进行中的拖拽（节点移动/缩放/端点改端）→ 上层 history 复原到拖拽前。 */
  onCancelDrag?: () => void;
  /** 右键菜单：报告屏幕坐标、世界坐标、命中的节点 id（空白为 null）；上层据此弹菜单。 */
  onContextMenu?: (clientX: number, clientY: number, worldX: number, worldY: number, nodeId: string | null) => void;
  /** 无障碍标签（含当前选中设备），随选中变化播报。 */
  ariaLabel?: string;
  /** 预览模式点击直达动作按钮（编辑模式命中按钮仅 onSelect 选中设备，配置入口统一在 Inspector）。 */
  onActionClick?: (nodeId: string, actionIndex: number) => void;
  /** 预览模式点击 ⋯ 溢出按钮：anchor 为该按钮右下角的屏幕坐标（浮层菜单定位用）。 */
  onActionOverflow?: (nodeId: string, anchorX: number, anchorY: number) => void;
  /** 按钮视觉态注入（pressed 由本组件内部管理，sent 由上层反馈状态驱动）。 */
  getActionFeedback?: (nodeId: string, actionIndex: number) => boolean;
}

/** 命令式句柄：供调色板「点选→画布中心新建」调用（视口中心世界坐标只在画布内部已知）。 */
export interface HmiCanvasHandle {
  placeAtCenter: (type: string) => void;
  /** 在当前视口中心新建一条自由点线段（实线管道或虚线引线）。 */
  placeLineAtCenter: (kind: "pipe" | "lead") => void;
  /** 平移视口把世界坐标点 (wx,wy) 居中（保持当前缩放）；用于从告警栏跳转到设备。 */
  centerOn: (wx: number, wy: number) => void;
}

const DRAG_THRESHOLD = 3; // 像素：超过即判定为拖拽（抑制选中）
const PORT_GRAB_PX = 9; // 屏幕像素：按下点离连接点多近算「抓住端口」（拉线 vs 拖节点的分界）
// 拉线提交阈值：端口误触（手抖/点按）常轻微超过 DRAG_THRESHOLD，若沿用它会把误触判成「拖出一条线」；
// 拉线是破坏性动作（凭空新增边），故单独给更高阈值，只有真拖拽（意图明确）才提交。
const CONNECT_COMMIT_PX = 24;
const HANDLE_PX = 9; // 屏幕像素：四角拉伸手柄边长（常驻屏幕尺寸，随缩放反算世界尺寸）
const HANDLE_GRAB_PX = 10; // 屏幕像素：按下点离手柄多近算「抓住手柄」
const ALIGN_PX = 10; // 屏幕像素：拖动节点时与邻居中线对齐的吸附阈值（Figma 式智能对齐参考线）

// 只用左右口的元件（泵/阀，hitBox.lrOnly）：连接点显示与落点判定只取 L/R（h=true 的口），不含顶/底。
const portsForBox = (box: HitBox) => (box.lrOnly ? portsOf(box).filter((p) => p.h) : portsOf(box));
const sideForBox = (box: HitBox, p: { x: number; y: number }): Side =>
  box.lrOnly ? (p.x < (box.cx ?? box.x + box.w / 2) ? "L" : "R") : nearestSide(box, p);

/** 四角拉伸手柄编号。 */
type HandleId = "tl" | "tr" | "bl" | "br";

/** 选框命中：两屏幕角点反算到世界系，返回 bbox 与选框相交的全部节点 id（按 bbox 近似，忽略旋转/圆形精修）。 */
function nodesInMarquee(boxes: readonly HitBox[], vp: Viewport, sx0: number, sy0: number, sx1: number, sy1: number): string[] {
  const a = toWorld(vp, sx0, sy0);
  const b = toWorld(vp, sx1, sy1);
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  const ids: string[] = [];
  for (const box of boxes) {
    if (box.x <= maxX && box.x + box.w >= minX && box.y <= maxY && box.y + box.h >= minY) ids.push(box.id);
  }
  return ids;
}

export const HmiCanvas = forwardRef<HmiCanvasHandle, HmiCanvasProps>(function HmiCanvas(props, ref) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<CanvasStage | null>(null);
  const loopRef = useRef<RenderLoop | null>(null);
  const vpRef = useRef<Viewport>(createViewport());
  const hitBoxesRef = useRef<HitBox[]>([]);
  const actionBoxesRef = useRef<ActionButtonBox[]>([]); // 动作按钮命中盒（世界坐标），每帧随 renderScene 刷新
  const edgePathsRef = useRef<EdgePath[]>([]); // 每条边当前实际折线（点击选中连线用），每帧刷新
  // 按住中的动作按钮（pressed 视觉态）：按下记录、松手判定同盒才触发；存 ref 配合 markDirty 走渲染循环
  const pressedActionRef = useRef<{ nodeId: string; action: number | "overflow" } | null>(null);
  const userAdjustedRef = useRef(false); // 用户是否手动平移/缩放过（true 时 resize 不强制 refit）
  // mode: node=拖节点 / pan=平移画布 / marquee=框选 / connect=画线（从图元端口拖出）/ edge-end=拖端点手柄 / group=拖整组（边本体触发）。
  // sx0,sy0=按下点（相对画布的屏幕坐标，框选用）。
  const dragRef = useRef<{
    x: number; y: number; moved: boolean;
    mode: "node" | "pan" | "marquee" | "connect" | "resize" | "edge-end" | "group"; nodeId: string | null; sx0: number; sy0: number;
    /** 拉线起手端口方位（mode=connect 时有值）：连线保留该出口。 */
    fromSide?: Side;
    /** 拉伸手柄（mode=resize 时有值）。 */
    handle?: HandleId;
    /** 等比拉伸基准（mode=resize 时有值）：锚点 + 按下时光标到锚点距 grabDist + 当时倍率 size0。
     *  拖拽中 factor = size0 × 当前距/grabDist —— 抓取处零跳变，按比例等比缩放。 */
    base?: { ax: number; ay: number; grabDist: number; size0: number };
    /** 端点手柄（mode=edge-end 时有值）：哪条边的哪端。 */
    edgeEnd?: { edgeId: string; which: "from" | "to" };
    /** 拖拽起始时被拖节点的中心（mode=node 单节点对齐用）：算意图位置，对齐邻居中线则吸附。 */
    nodeStart?: { x: number; y: number };
  } | null>(null);
  /** 拖动单节点时的对齐参考线（世界坐标轴值）：v=竖线 x、h=横线 y；渲染循环每帧读。 */
  const alignGuidesRef = useRef<{ v?: number; h?: number } | null>(null);
  const suppressClickRef = useRef(false); // 拖拽结束后抑制紧随的 click 选中
  const spaceHeldRef = useRef(false); // 空格按住时左键拖动=平移（避让框选）
  // 画线（端口拖拽）：connect=拖拽中的起点节点；cursor=橡皮筋末端；hover=悬停节点（显示连接点）；
  // target=拖拽中悬停的合法目标节点（高亮其吸附端口）。存 ref：渲染循环每帧读、高频更新不走 React。
  const connectFromRef = useRef<string | null>(null);
  const lineCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lineHoverRef = useRef<string | null>(null);
  const connectTargetRef = useRef<string | null>(null);
  /** 端点拖拽吸附目标：节点 id+side（吸元件本体）或自由坐标点（吸管道/其他边）。null=无吸附。 */
  const edgeSnapRef = useRef<{ node?: string; side?: Side; point?: [number, number] } | null>(null);
  const propsRef = useRef(props);
  // 选框矩形（相对画布的屏幕坐标），仅拖拽中存在；用 HTML 浮层渲染，与渲染循环解耦。
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // 每次渲染后同步最新 props 到 ref，供 rAF 回调读取（不在渲染期写 ref）
  useEffect(() => {
    propsRef.current = props;
  });

  // 适应视图：按场景包围盒重新 fit 并清除手动调整标记。
  const applyFit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const p = propsRef.current;
    const box = sceneBounds(p.scene, p.registry);
    // 图元下方有位号 + 内联值两行文字（在 bounds 外），fit 时向下预留余量避免裁切
    const withLabels = { ...box, h: box.h + 38 };
    // maxScale=1：不把图放大到超过设计尺寸（稀疏图保持自然大小居中，避免图元过大）
    vpRef.current = fit(withLabels, stage.size(), 24, 1);
    userAdjustedRef.current = false;
    loopRef.current?.markDirty();
  }, []);

  // 以画布中心为锚按因子缩放（按钮用）。
  const zoomByFactor = useCallback((factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const { w, h } = stage.size();
    const vp = vpRef.current;
    vpRef.current = zoomAt(vp, w / 2, h / 2, clampScale(vp.scale * factor));
    userAdjustedRef.current = true;
    loopRef.current?.markDirty();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = createCanvasStage(canvas, () => {
      // 用户手动导航过则保留其视口，仅重绘；否则随容器尺寸重新 fit。
      if (userAdjustedRef.current) loopRef.current?.markDirty();
      else applyFit();
    });
    stageRef.current = stage;

    const loop = createRenderLoop({
      render: (timeMs) => {
        const p = propsRef.current;
        const selected = new Set(p.selectedIds);
        const result = renderScene(
          p.scene, p.registry, p.getState, (id) => selected.has(id), p.palette, p.isEdgeFlowing, p.isLocked,
          // 按钮视觉态：内部 pressed 优先，其次上层 sent 反馈，缺省 idle
          (nodeId, action) => {
            const pressed = pressedActionRef.current;
            if (pressed && pressed.nodeId === nodeId && pressed.action === action) return "pressed";
            if (typeof action === "number" && p.getActionFeedback?.(nodeId, action)) return "sent";
            return "idle";
          },
          (edgeId) => p.selectedEdgeIds?.includes(edgeId) ?? false,
          vpRef.current.scale,
        );
        hitBoxesRef.current = result.hitBoxes;
        actionBoxesRef.current = result.actionHitBoxes;
        edgePathsRef.current = result.edgePaths;
        // 拉线叠加层（选择工具，编辑态）：悬停节点显示四向连接点（拉线起手锚）；
        // 拖拽中显示「起点中心 → 光标」正交虚线橡皮筋 + 合法目标的吸附端口高亮。
        let primitives = result.primitives;
        if (p.onAddEdge) { // 端口/橡皮筋叠加层：编辑态(平移/选择皆可)都显示，连线不分工具
          const extra: typeof result.primitives[number][] = [];
          const boxOf = (id: string) => result.hitBoxes.find((b) => b.id === id);
          const dot = (x: number, y: number, r = 3) =>
            ({ kind: "circle", cx: x, cy: y, r, style: { fill: p.palette.selection } }) as const;
          const fromId = connectFromRef.current;
          if (fromId) {
            const fb = boxOf(fromId);
            const cur = lineCursorRef.current;
            if (fb && cur) {
              // 橡皮筋从起手端口出（与最终连线同几何——「画时所见 = 提交所得」）；
              // 光标端用零尺寸盒复用 sideRoute，落点入口在松手时才定。
              const fromSide = dragRef.current?.mode === "connect" ? dragRef.current.fromSide : undefined;
              extra.push({
                kind: "polyline",
                points: fromSide
                  ? sideRoute(fb, { x: cur.x, y: cur.y, w: 0, h: 0 }, fromSide)
                  : centerRoute({ x: fb.x + fb.w / 2, y: fb.y + fb.h / 2 }, cur),
                style: { stroke: p.palette.selection, strokeWidth: 1.5, dash: [6, 4] },
              });
              const tb = connectTargetRef.current ? boxOf(connectTargetRef.current) : undefined;
              if (tb) {
                // 目标节点轮廓：淡青虚线框，明确「会连到这个元件」（不只是端口小圆）。
                extra.push({ kind: "rect", x: tb.x, y: tb.y, w: tb.w, h: tb.h, style: { stroke: p.palette.selection, strokeWidth: 1.5, dash: [5, 3] } });
                // 预览的目标端口须与松手提交同一套；且区分实/虚：虚线引线（任一端仪表）可连任意边→nearestSide，实线→sideForBox(泵阀L/R)。
                const isLead = p.scene.byId[connectFromRef.current ?? ""]?.type === "instrument" || p.scene.byId[connectTargetRef.current ?? ""]?.type === "instrument";
                const tp = portOf(tb, isLead ? nearestSide(tb, cur) : sideForBox(tb, cur));
                extra.push(dot(tp.x, tp.y, 4.5));
              }
            }
          } else if (lineHoverRef.current) {
            // 悬停元件：显四向连接点；离光标最近的那个放大 + 描环（明确「从这里拉线」）。
            const hb = boxOf(lineHoverRef.current);
            const cur = lineCursorRef.current;
            if (hb) {
              const ports = portsForBox(hb);
              let ni = -1, nd = Infinity;
              if (cur) ports.forEach((q, i) => { const dd = (q.x - cur.x) ** 2 + (q.y - cur.y) ** 2; if (dd < nd) { nd = dd; ni = i; } });
              ports.forEach((q, i) => {
                extra.push(dot(q.x, q.y, i === ni ? 4.5 : 3));
                if (i === ni) extra.push({ kind: "circle", cx: q.x, cy: q.y, r: 7, style: { stroke: p.palette.selection, strokeWidth: 1.5 } });
              });
            }
          }
          if (extra.length) primitives = [...primitives, ...extra];
        }
        // 移动节点的对齐参考线（Figma 式）：拖动单节点与邻居中线对齐时，画贯穿画布的虚线提示。
        const ag = alignGuidesRef.current;
        if (ag) { // 对齐参考线：只要在拖元件（alignGuidesRef 有值即拖节点中）就显示，与平移/选择工具无关
          const vp = vpRef.current;
          const tl = toWorld(vp, 0, 0);
          const br = toWorld(vp, canvas.clientWidth, canvas.clientHeight);
          const guides: typeof result.primitives[number][] = [];
          // 醒目对齐参考线（Figma 式，区别于选中青，一眼可见）：用 palette.guide token（不再写死 hex）。
          const G = p.palette.guide;
          if (ag.v !== undefined) guides.push({ kind: "line", x1: ag.v, y1: tl.y, x2: ag.v, y2: br.y, style: { stroke: G, strokeWidth: 2, dash: [6, 4] } });
          if (ag.h !== undefined) guides.push({ kind: "line", x1: tl.x, y1: ag.h, x2: br.x, y2: ag.h, style: { stroke: G, strokeWidth: 2, dash: [6, 4] } });
          if (guides.length) primitives = [...primitives, ...guides];
        }
        // 拉伸框叠加（编辑+选择工具+单选）：紧贴可见主体的虚线包围框 + 四角实心圆角抓点，
        // 一眼读作「可拖角缩放」（取代易误解的孤立小方块）。尺寸反算世界系，保持常驻屏幕大小。
        if (p.onResizeNode && (p.tool ?? "pan") === "select" && p.selectedIds.length === 1) {
          const node = p.scene.byId[p.selectedIds[0]];
          if (node) {
            const b = p.registry.get(node.type).bounds(node);
            const hw = Math.min(node.x - b.x, b.x + b.w - node.x) * (node.sizeX ?? 1);
            const hh = Math.min(node.y - b.y, b.y + b.h - node.y) * (node.sizeY ?? 1);
            const inv = 1 / vpRef.current.scale;
            const k = HANDLE_PX * inv; // 抓点边长（屏幕常驻）
            const pad = 4 * inv; // 框离主体外扩，避免压住轮廓
            const fx = node.x - hw - pad, fy = node.y - hh - pad, fw = (hw + pad) * 2, fh = (hh + pad) * 2;
            const frame = { kind: "rect", x: fx, y: fy, w: fw, h: fh, style: { stroke: p.palette.selection, strokeWidth: 1 * inv, dash: [4 * inv, 3 * inv] } } as const;
            const corners: [number, number][] = [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]];
            const knobs = corners.map(([x, y]) =>
              ({ kind: "rect", x: x - k / 2, y: y - k / 2, w: k, h: k, r: 2 * inv, style: { fill: p.palette.selection, stroke: p.palette.canvas, strokeWidth: 1.5 * inv } }) as const,
            );
            primitives = [...primitives, frame, ...knobs];
          }
        }
        // 连线端点手柄叠加（编辑态+恰好选中单条边）：两端实心圆抓点，屏幕常驻尺寸，可拖动改端点。
        if (p.onSetEdgeEnd && p.selectedEdgeIds?.length === 1) {
          const ep = edgePathsRef.current.find((e) => e.id === p.selectedEdgeIds![0]);
          if (ep && ep.points.length >= 2) {
            const inv = 1 / vpRef.current.scale;
            const r = HANDLE_PX * 0.55 * inv; // 圆半径（屏幕常驻 ~5px）
            const endPts: [number, number][] = [
              [ep.points[0][0], ep.points[0][1]],
              [ep.points[ep.points.length - 1][0], ep.points[ep.points.length - 1][1]],
            ];
            const endKnobs = endPts.map(([x, y]) =>
              ({ kind: "circle", cx: x, cy: y, r, style: { fill: p.palette.selection, stroke: p.palette.canvas, strokeWidth: 1.5 * inv } }) as const,
            );
            primitives = [...primitives, ...endKnobs];
          }
        }
        // 端点拖拽吸附高亮（拖 edge-end 中且有吸附目标）：
        // 吸节点 → 在目标端口画填充圆（与拉线目标吸附高亮同视觉语言）；
        // 吸管道 → 在管道最近点画空心圆环，提示「连到此管道处」。
        const drag = dragRef.current;
        if (drag?.mode === "edge-end" && edgeSnapRef.current) {
          const snap = edgeSnapRef.current;
          const inv = 1 / vpRef.current.scale;
          if (snap.node && snap.side) {
            // 吸节点端口：填充圆（与 connect 模式目标吸附点风格一致）
            const box = result.hitBoxes.find((b) => b.id === snap.node);
            if (box) {
              const port = (() => {
                if (snap.side === "L") return { x: box.x, y: box.cy ?? box.y + box.h / 2 };
                if (snap.side === "R") return { x: box.x + box.w, y: box.cy ?? box.y + box.h / 2 };
                if (snap.side === "T") return { x: box.cx ?? box.x + box.w / 2, y: box.y };
                return { x: box.cx ?? box.x + box.w / 2, y: box.y + box.h };
              })();
              primitives = [...primitives, {
                kind: "circle" as const,
                cx: port.x, cy: port.y,
                r: 4.5 * inv,
                style: { fill: p.palette.selection },
              }];
            }
          } else if (snap.point) {
            // 吸管道点：空心圆环（区别于节点端口，暗示「落在管道上」）
            const [cx, cy] = snap.point;
            const ro = 5 * inv;
            const ri = 2.5 * inv;
            primitives = [...primitives,
              { kind: "circle" as const, cx, cy, r: ro, style: { stroke: p.palette.selection, strokeWidth: 1.5 * inv } },
              { kind: "circle" as const, cx, cy, r: ri, style: { fill: p.palette.selection } },
            ];
          }
        }
        stage.draw(primitives, vpRef.current, timeMs);
      },
      hasAnimation: () => propsRef.current.hasAnimation(),
    });
    loopRef.current = loop;

    const offData = propsRef.current.subscribeData(() => loop.markDirty());

    // 滚轮缩放（以光标为锚）。native 非被动监听以便 preventDefault 阻止页面滚动。
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const vp = vpRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      vpRef.current = zoomAt(vp, e.clientX - rect.left, e.clientY - rect.top, clampScale(vp.scale * factor));
      userAdjustedRef.current = true;
      loop.markDirty();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    applyFit();
    loop.start();
    loop.markDirty();

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      offData();
      loop.stop();
      stage.destroy();
    };
  }, [applyFit]);

  // schema / palette / 选中 / 联锁签名 変化时强制重绘
  useEffect(() => {
    loopRef.current?.markDirty();
  }, [props.scene, props.palette, props.redrawKey]);

  // 空格按住 = 临时平移模式（避让左键框选）。在文本输入控件里输入空格时不拦截。
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el?.tagName) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      spaceHeldRef.current = true;
      if (document.activeElement === canvasRef.current || e.target === document.body) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // 命令式：调色板点选 → 在当前视口中心新建（中心世界坐标只在画布内已知）。
  useImperativeHandle(ref, () => ({
    placeAtCenter: (type: string) => {
      const stage = stageRef.current;
      const onAddNode = propsRef.current.onAddNode;
      if (!stage || !onAddNode) return;
      const { w, h } = stage.size();
      const c = toWorld(vpRef.current, w / 2, h / 2);
      onAddNode(type, c.x, c.y);
    },
    placeLineAtCenter: (kind: "pipe" | "lead") => {
      const stage = stageRef.current;
      const onPlaceLine = propsRef.current.onPlaceLine;
      if (!stage || !onPlaceLine) return;
      const { w, h } = stage.size();
      const c = toWorld(vpRef.current, w / 2, h / 2);
      onPlaceLine(kind, c.x, c.y);
    },
    centerOn: (wx: number, wy: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const { w, h } = stage.size();
      const vp = vpRef.current;
      vpRef.current = { ...vp, x: w / 2 - wx * vp.scale, y: h / 2 - wy * vp.scale };
      userAdjustedRef.current = true; // 防 resize 自动 refit 把居中冲掉
      loopRef.current?.markDirty();
    },
  }), []);

  const relPos = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { sx: e.clientX - rect.left, sy: e.clientY - rect.top } : null;
  };

  // —— 拉线（选择工具内置：从图元连接点拖出）——
  const cancelConnect = useCallback(() => {
    if (!connectFromRef.current && !lineHoverRef.current && !connectTargetRef.current) return;
    connectFromRef.current = null;
    lineCursorRef.current = null;
    lineHoverRef.current = null;
    connectTargetRef.current = null;
    loopRef.current?.markDirty();
  }, []);
  // 切出选择工具时清掉拉线拖拽/悬停态。
  useEffect(() => {
    if (props.tool !== "select") cancelConnect();
  }, [props.tool, cancelConnect]);

  /** 屏幕坐标命中动作按钮 → 返回按钮盒。按钮优先于节点/端口命中（停靠在设备下方，区域独立）。 */
  const actionHit = (sx: number, sy: number): ActionButtonBox | null => {
    const w = toWorld(vpRef.current, sx, sy);
    return hitTestActionButtons(actionBoxesRef.current, w.x, w.y);
  };

  /** 按下点是否抓住某图元的连接点（屏幕距 < PORT_GRAB_PX）→ 返回该图元 id。拉线 vs 拖节点的分界。 */
  /** 按下点命中的连接点：返回节点与端口方位（拉线起手锚 → 连线保留该出口）。 */
  const portHit = (sx: number, sy: number): { id: string; side: Side } | null => {
    const w = toWorld(vpRef.current, sx, sy);
    const grab = PORT_GRAB_PX / vpRef.current.scale;
    for (const box of hitBoxesRef.current) {
      for (const q of portsForBox(box)) {
        if (Math.hypot(q.x - w.x, q.y - w.y) <= grab) return { id: box.id, side: sideForBox(box, q) };
      }
    }
    return null;
  };

  /**
   * 按下点命中选中边的某端点手柄（屏幕距 < HANDLE_GRAB_PX）→ 返回 { edgeId, which }；否则 null。
   * 仅在编辑态且有 onSetEdgeEnd + 恰好选中单条边时生效。
   */
  const edgeEndHit = (sx: number, sy: number): { edgeId: string; which: "from" | "to" } | null => {
    const p = propsRef.current;
    if (!p.onSetEdgeEnd || p.selectedEdgeIds?.length !== 1) return null;
    const ep = edgePathsRef.current.find((e) => e.id === p.selectedEdgeIds![0]);
    if (!ep || ep.points.length < 2) return null;
    const first = ep.points[0];
    const last = ep.points[ep.points.length - 1];
    const sf = toScreen(vpRef.current, first[0], first[1]);
    if (Math.hypot(sf.x - sx, sf.y - sy) <= HANDLE_GRAB_PX) return { edgeId: ep.id, which: "from" };
    const sl = toScreen(vpRef.current, last[0], last[1]);
    if (Math.hypot(sl.x - sx, sl.y - sy) <= HANDLE_GRAB_PX) return { edgeId: ep.id, which: "to" };
    return null;
  };

  /** 单选且可拉伸（编辑+选择工具+恰好选 1 个）时返回该节点 id，否则 null —— 拉伸手柄的显示/命中门控。 */
  const soleResizable = (): string | null => {
    const p = propsRef.current;
    if (!p.onResizeNode || (p.tool ?? "pan") !== "select") return null;
    return p.selectedIds.length === 1 ? p.selectedIds[0] : null;
  };

  /**
   * 拉伸参考框：锚点 + 紧致 body 半宽/半高（取锚点两侧最小半距 → 排除标签/侧桩等非对称留白，
   * 框紧贴可见主体，不飘在元件外）+ 当前缩放倍率。手柄渲染/命中/拖拽换算共用同一基准。
   */
  const resizeFrame = (id: string): { ax: number; ay: number; hw: number; hh: number; sx: number; sy: number } | null => {
    const node = propsRef.current.scene.byId[id];
    if (!node) return null;
    const b = propsRef.current.registry.get(node.type).bounds(node);
    return {
      ax: node.x,
      ay: node.y,
      hw: Math.min(node.x - b.x, b.x + b.w - node.x),
      hh: Math.min(node.y - b.y, b.y + b.h - node.y),
      sx: node.sizeX ?? 1,
      sy: node.sizeY ?? 1,
    };
  };

  /** 选中节点四角手柄（世界系，紧致 body 盒按当前缩放 + 外扩 pad 后的四角，与渲染的抓点对齐）。 */
  const cornerHandlesWorld = (id: string): { h: HandleId; x: number; y: number }[] | null => {
    const f = resizeFrame(id);
    if (!f) return null;
    const pad = 4 / vpRef.current.scale; // 与渲染框外扩一致，保证命中=所见
    const hw = f.hw * f.sx + pad;
    const hh = f.hh * f.sy + pad;
    return [
      { h: "tl", x: f.ax - hw, y: f.ay - hh },
      { h: "tr", x: f.ax + hw, y: f.ay - hh },
      { h: "bl", x: f.ax - hw, y: f.ay + hh },
      { h: "br", x: f.ax + hw, y: f.ay + hh },
    ];
  };

  /** 按下点命中的拉伸手柄（屏幕距 < HANDLE_GRAB_PX）→ 返回手柄编号；否则 null。 */
  const handleHit = (sx: number, sy: number): HandleId | null => {
    const id = soleResizable();
    if (!id) return null;
    const corners = cornerHandlesWorld(id);
    if (!corners) return null;
    for (const c of corners) {
      const s = toScreen(vpRef.current, c.x, c.y);
      if (Math.hypot(s.x - sx, s.y - sy) <= HANDLE_GRAB_PX) return c.h;
    }
    return null;
  };

  /** 松手提交连线：保留起手端口与落点入口方位（sideRoute 走线，渲染时随图元位置重算）。落空白时生成 node→自由点边。 */
  const commitConnect = (fromId: string, fromSide: Side | undefined, sx: number, sy: number) => {
    const toId = hitTest(hitBoxesRef.current, vpRef.current, sx, sy) ?? connectTargetRef.current;
    const w = toWorld(vpRef.current, sx, sy);
    if (toId && toId !== fromId) {
      const fb = hitBoxesRef.current.find((b) => b.id === fromId);
      const tb = hitBoxesRef.current.find((b) => b.id === toId);
      if (!fb || !tb) return;
      // 虚线引线（任一端为仪表）可连任意边 → nearestSide；实线管道连泵/阀只取 L/R → sideForBox。
      const isLead = propsRef.current.scene.byId[fromId]?.type === "instrument" || propsRef.current.scene.byId[toId]?.type === "instrument";
      const toSide = isLead ? nearestSide(tb, w) : sideForBox(tb, w);
      propsRef.current.onAddEdge?.(fromId, toId, sideRoute(fb, tb, fromSide, toSide), { fromSide, toSide });
      return;
    }
    // 落空白（无目标节点）→ node→自由点边。需要起手方位走 sideRoute（自由端零尺寸盒）。
    if (toId === fromId) return; // 落回自身 = 取消
    const fb = hitBoxesRef.current.find((b) => b.id === fromId);
    if (!fb || !fromSide) return;
    propsRef.current.onAddEdgePoint?.(fromId, fromSide, [w.x, w.y]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = relPos(e);
    if (!pos) return;
    if (e.button === 2) return; // 右键留给 contextmenu：不启任何拖拽，免菜单存活期 pointerup 落到遮罩卡住
    const sel = (propsRef.current.tool ?? "pan") === "select";
    // 动作按钮命中优先于一切节点/端口/框选流程（中键平移、空格平移、Shift 框选保持原语义）。
    // 只记 pressed 视觉态，不设 dragRef —— 不进入拖拽/框选/拉线；触发与分流在 pointerup。
    if (e.button === 0 && !spaceHeldRef.current && !e.shiftKey) {
      const box = actionHit(pos.sx, pos.sy);
      if (box) {
        pressedActionRef.current = { nodeId: box.nodeId, action: box.action };
        loopRef.current?.markDirty();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // 合成/无效 pointerId 时忽略：捕获仅为松手判定稳定性优化，非必需
        }
        return;
      }
    }
    // 中键，或空格+左键 → 平移画布。
    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
      e.preventDefault();
      dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: "pan", nodeId: null, sx0: pos.sx, sy0: pos.sy };
    } else if (e.button === 0 && !e.shiftKey && edgeEndHit(pos.sx, pos.sy)) {
      // 抓住连线端点手柄 = 拖改端点（优先于 portHit/节点命中，手柄在端点上）。
      const hit = edgeEndHit(pos.sx, pos.sy)!;
      dragRef.current = {
        x: e.clientX, y: e.clientY, moved: false, mode: "edge-end", nodeId: null,
        sx0: pos.sx, sy0: pos.sy, edgeEnd: hit,
      };
    } else if (e.button === 0 && !e.shiftKey && handleHit(pos.sx, pos.sy)) {
      // 抓住四角手柄 = 等比拉伸（优先于拖节点本体；手柄在角上、与边中点端口不重叠，拉线不受影响）。
      const handle = handleHit(pos.sx, pos.sy)!;
      const f = resizeFrame(propsRef.current.selectedIds[0]);
      if (f) {
        const gw = toWorld(vpRef.current, pos.sx, pos.sy);
        dragRef.current = {
          x: e.clientX, y: e.clientY, moved: false, mode: "resize", nodeId: propsRef.current.selectedIds[0], sx0: pos.sx, sy0: pos.sy, handle,
          base: { ax: f.ax, ay: f.ay, grabDist: Math.max(1, Math.hypot(gw.x - f.ax, gw.y - f.ay)), size0: f.sx },
        };
      }
    } else if (e.button === 0 && !e.shiftKey && propsRef.current.onAddEdge && portHit(pos.sx, pos.sy)) {
      // 按在连接点上 = 拉线（平移/选择工具皆可，不需要单独连线模式；端口优先于节点拖拽，按在身体上仍是移动节点）。
      const from = portHit(pos.sx, pos.sy)!;
      connectFromRef.current = from.id;
      lineHoverRef.current = null;
      lineCursorRef.current = toWorld(vpRef.current, pos.sx, pos.sy);
      loopRef.current?.markDirty();
      dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: "connect", nodeId: from.id, fromSide: from.side, sx0: pos.sx, sy0: pos.sy };
    } else if (e.button === 0) {
      // 拖节点不分 pan/select：编辑态命中节点即移动（Shift 恒框选故除外）。
      // 预览态（无 onSelectionDrag）不能移动节点，hitTest 跳过，拖节点回落平移。
      const canMoveNodes = !!propsRef.current.onSelectionDrag;
      const hitEdgeBody = (() => {
        const p = propsRef.current;
        // 仅选择工具：pan 工具拖已选中边应平移画布，不被整组拖拽劫持。
        if (!p.onSelectionDrag || !p.selectedEdgeIds?.length || e.shiftKey || !sel) return null;
        const eid = hitTestEdges(edgePathsRef.current, vpRef.current, pos.sx, pos.sy);
        return eid && p.selectedEdgeIds.includes(eid) ? eid : null;
      })();
      const nodeId = canMoveNodes && !e.shiftKey ? hitTest(hitBoxesRef.current, vpRef.current, pos.sx, pos.sy) : null;
      if (hitEdgeBody && !nodeId) {
        // 命中选中边本体且未命中节点 → group 拖拽（整选区平移）
        dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: "group", nodeId: null, sx0: pos.sx, sy0: pos.sy };
      } else if (nodeId) {
        // 命中节点 → 移动。不在按下时改选择：开检视面板会缩窄画布触发 refit，
        // 紧随的 click 按旧坐标再 hitTest 会落空而误取消。选择交给 click（未移动）处理。
        dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: "node", nodeId, sx0: pos.sx, sy0: pos.sy };
      } else if (sel || e.shiftKey) {
        // 未命中节点 + 选择工具空白，或 Shift+拖 → 框选多选。
        dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: "marquee", nodeId: null, sx0: pos.sx, sy0: pos.sy };
        setMarquee({ x0: pos.sx, y0: pos.sy, x1: pos.sx, y1: pos.sy });
      } else {
        // 平移工具空白（或预览态拖节点）：平移，click 负责选中。
        dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: "pan", nodeId: null, sx0: pos.sx, sy0: pos.sy };
      }
    } else {
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 合成/无效 pointerId 时忽略：捕获仅为拖拽体验优化，非必需
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
    if (e.dataTransfer.types.includes(PALETTE_MIME) || e.dataTransfer.types.includes(PALETTE_LINE_MIME)) {
      e.preventDefault(); // 允许 drop
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    const pos = relPos(e);
    if (!pos) return;
    // 连线类 drop
    if (e.dataTransfer.types.includes(PALETTE_LINE_MIME)) {
      const kind = e.dataTransfer.getData(PALETTE_LINE_MIME) as "pipe" | "lead";
      const onPlaceLine = propsRef.current.onPlaceLine;
      if (!kind || !onPlaceLine) return;
      e.preventDefault();
      const c = toWorld(vpRef.current, pos.sx, pos.sy);
      onPlaceLine(kind, c.x, c.y);
      return;
    }
    // 图元 drop
    const onAddNode = propsRef.current.onAddNode;
    if (!onAddNode) return;
    const type = e.dataTransfer.getData(PALETTE_MIME);
    if (!type) return;
    e.preventDefault();
    const c = toWorld(vpRef.current, pos.sx, pos.sy);
    onAddNode(type, c.x, c.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 无拖拽/无按住按钮时的悬停反馈：按钮 pointer 光标（编辑/预览皆然，优先于拉线十字）。
    if (!dragRef.current && !pressedActionRef.current) {
      const pos = relPos(e);
      if (pos) {
        const overAction = actionHit(pos.sx, pos.sy) !== null;
        const canvas = canvasRef.current;
        if (propsRef.current.onAddEdge) {
          // 编辑态悬停（平移/选择皆可）：跟踪悬停图元显示四向连接点（提示「从这里拉线」），靠近连接点光标变十字。
          const overNode = hitTest(hitBoxesRef.current, vpRef.current, pos.sx, pos.sy);
          const hover = overNode ?? portHit(pos.sx, pos.sy)?.id ?? null;
          // 记录世界光标，供叠加层高亮「离光标最近的连接点」。
          lineCursorRef.current = toWorld(vpRef.current, pos.sx, pos.sy);
          if (hover !== lineHoverRef.current) {
            lineHoverRef.current = hover;
            loopRef.current?.markDirty();
          } else if (hover) {
            loopRef.current?.markDirty(); // 悬停同一元件内移动 → 刷新最近端口高亮
          }
          // 拉伸手柄光标优先：tl/br 西北-东南、tr/bl 东北-西南双向箭头。
          const hh = handleHit(pos.sx, pos.sy);
          if (canvas) {
            canvas.style.cursor = hh
              ? hh === "tl" || hh === "br" ? "nwse-resize" : "nesw-resize"
              : overAction ? "pointer"
              : portHit(pos.sx, pos.sy) ? "crosshair"
              : (propsRef.current.onSelectEdge && hitTestEdges(edgePathsRef.current, vpRef.current, pos.sx, pos.sy)) ? "pointer"
              : "";
          }
        } else if (canvas) {
          // 平移工具/预览：悬停按钮亮 pointer；编辑态悬停节点/选中边给 move（暗示可拖），其余回落 className 的 grab。
          const overNode = !!propsRef.current.onSelectionDrag && hitTest(hitBoxesRef.current, vpRef.current, pos.sx, pos.sy) !== null;
          canvas.style.cursor = overAction ? "pointer" : overNode ? "move" : "";
        }
      }
    }
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
    const firstMove = !d.moved;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.mode === "node" && d.nodeId) {
      // 拖节点：屏幕增量 → 世界增量（除以缩放）。拖到的若在选择集内则整组移动，否则只动它。
      const p = propsRef.current;
      const vp = vpRef.current;
      // 仅 2+ 选中才算"整组"（单节点即便已选中也要走对齐分支；原来 includes 把单选当组 → 永不对齐）
      const grouped = p.selectedIds.length > 1 && p.selectedIds.includes(d.nodeId);
      if (firstMove) {
        p.onNodesDragStart?.(); // 拖拽起点：整段拖拽合并为一步历史
        const n0 = p.scene.byId[d.nodeId];
        if (n0 && !grouped) d.nodeStart = { x: n0.x, y: n0.y }; // 单节点：记起始中心，做对齐吸附
      }
      const nodeIds = grouped ? p.selectedIds : [d.nodeId];
      const edgeIds = grouped ? (p.selectedEdgeIds ?? []) : [];
      const cur = p.scene.byId[d.nodeId];
      if (!grouped && d.nodeStart && cur) {
        // 智能对齐：算意图中心（起始 + 累计鼠标位移），与其他节点中心 x/y 在阈值内则吸附 + 显参考线。
        const pos = relPos(e)!;
        const ws = toWorld(vp, d.sx0, d.sy0);
        const wn = toWorld(vp, pos.sx, pos.sy);
        const rawX = d.nodeStart.x + (wn.x - ws.x);
        const rawY = d.nodeStart.y + (wn.y - ws.y);
        const tol = ALIGN_PX / vp.scale;
        let gv: number | undefined, gh: number | undefined;
        for (const b of hitBoxesRef.current) {
          if (b.id === d.nodeId) continue;
          const ncx = b.cx ?? b.x + b.w / 2;
          const ncy = b.cy ?? b.y + b.h / 2;
          if (gv === undefined && Math.abs(ncx - rawX) <= tol) gv = ncx;
          if (gh === undefined && Math.abs(ncy - rawY) <= tol) gh = ncy;
          if (gv !== undefined && gh !== undefined) break;
        }
        const tx = gv ?? rawX; // 对齐则吸到邻居中线
        const ty = gh ?? rawY;
        p.onSelectionDrag?.(nodeIds, edgeIds, tx - cur.x, ty - cur.y);
        alignGuidesRef.current = gv !== undefined || gh !== undefined ? { v: gv, h: gh } : null;
        loopRef.current?.markDirty();
      } else {
        p.onSelectionDrag?.(nodeIds, edgeIds, dx / vp.scale, dy / vp.scale);
      }
    } else if (d.mode === "group") {
      // group 拖拽：整选区平移（selectedIds + selectedEdgeIds）
      const p = propsRef.current;
      if (firstMove) p.onNodesDragStart?.();
      p.onSelectionDrag?.(p.selectedIds, p.selectedEdgeIds ?? [], dx / vpRef.current.scale, dy / vpRef.current.scale);
    } else if (d.mode === "pan") {
      vpRef.current = panBy(vpRef.current, dx, dy);
      userAdjustedRef.current = true;
      loopRef.current?.markDirty();
    } else if (d.mode === "connect") {
      // 画线拖拽（画板式）：橡皮筋末端跟随光标；**只在光标落在某元件本体上时**才记为目标（高亮其端口、
      // 松手即连），否则无目标（松手落空白 = node→自由点边）。不用磁吸光晕提前把线拉到附近元件。
      const pos = relPos(e);
      if (pos) {
        lineCursorRef.current = toWorld(vpRef.current, pos.sx, pos.sy);
        const hit = hitTest(hitBoxesRef.current, vpRef.current, pos.sx, pos.sy);
        connectTargetRef.current = hit && hit !== d.nodeId ? hit : null;
        loopRef.current?.markDirty();
      }
    } else if (d.mode === "resize" && d.nodeId && d.base) {
      // 等比拉伸：光标到锚点的对角距 / 原始紧致盒对角半距 = 统一缩放倍率（sizeX==sizeY，锁纵横比）。
      // 拖任一角都按对角距等比放大/缩小，绕节点中心，不变形。
      const p = propsRef.current;
      if (firstMove) p.onNodesDragStart?.(); // 整段拉伸合并为一步历史（复用拖拽起点）
      const pos = relPos(e);
      if (pos) {
        const w = toWorld(vpRef.current, pos.sx, pos.sy);
        const { ax, ay, grabDist, size0 } = d.base;
        const factor = Math.min(5, Math.max(0.25, (size0 * Math.hypot(w.x - ax, w.y - ay)) / grabDist));
        p.onResizeNode?.(d.nodeId, factor, factor); // 等比：两轴同倍率，锁纵横比
      }
    } else if (d.mode === "edge-end" && d.edgeEnd) {
      // 拖连线端点：实时移动端点（history.replace 合并为一步）；首次移动触发 begin（与拖节点复用同一起点）。
      const p = propsRef.current;
      if (firstMove) p.onNodesDragStart?.();
      const pos = relPos(e);
      if (pos) {
        const vp = vpRef.current;
        const w = toWorld(vp, pos.sx, pos.sy);
        // 实时自由落点（吸附目标在 pointerup 才锁定，move 仅跟光标保持流畅感）
        p.onSetEdgeEnd?.(d.edgeEnd.edgeId, d.edgeEnd.which, { point: [w.x, w.y] }, false);
        // 画板式绑定：端点**只在光标落在元件本体上时**才绑该元件（贴最近侧），否则自由落点——
        // 绝不吸附到管道/其他线（吸线=两线重合、流向看不清），也不用磁吸光晕提前把端点拉过去。
        // Alt 按住 = 即便压在元件上也不绑、纯自由放。
        const nodeHit = e.altKey ? null : hitTest(hitBoxesRef.current, vp, pos.sx, pos.sy);
        const hb = nodeHit ? hitBoxesRef.current.find((b) => b.id === nodeHit) : undefined;
        edgeSnapRef.current = hb ? { node: nodeHit!, side: sideForBox(hb, w) } : null;
        loopRef.current?.markDirty();
      }
    } else {
      const pos = relPos(e);
      if (pos) setMarquee({ x0: d.sx0, y0: d.sy0, x1: pos.sx, y1: pos.sy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 动作按钮松手：仍命中同一盒才触发——编辑/预览两态都执行动作（直达 onActionClick / 溢出
    // onActionOverflow，锚点=按钮右下角屏幕坐标）。按钮 = 触发动作；配置入口在 Inspector「配置操作…」，
    // 选中设备改点设备本体（按钮区在设备盒外）。
    const pressed = pressedActionRef.current;
    if (pressed) {
      pressedActionRef.current = null;
      loopRef.current?.markDirty();
      const pos = relPos(e);
      const box = pos ? actionHit(pos.sx, pos.sy) : null;
      if (box && box.nodeId === pressed.nodeId && box.action === pressed.action) {
        const p = propsRef.current;
        if (box.action === "overflow") {
          const rect = canvasRef.current?.getBoundingClientRect();
          const corner = toScreen(vpRef.current, box.x + box.w, box.y + box.h);
          p.onActionOverflow?.(box.nodeId, (rect?.left ?? 0) + corner.x, (rect?.top ?? 0) + corner.y);
        } else {
          p.onActionClick?.(box.nodeId, box.action);
        }
      }
      suppressClickRef.current = true; // 紧随的 click 不再走节点 hitTest（按钮区在节点盒外，否则会误清选择）
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    const d = dragRef.current;
    if (d?.mode === "edge-end" && d.edgeEnd) {
      // 松手：从 edgeSnapRef 读取绑定目标（仅当端点压在元件本体上时有值，绑该元件；否则自由落点，不吸管道）。
      const pos = relPos(e);
      if (pos && d.moved) {
        const p = propsRef.current;
        const snap = edgeSnapRef.current;
        if (snap?.node && snap.side) {
          // 吸附到元件节点端口
          p.onSetEdgeEnd?.(d.edgeEnd.edgeId, d.edgeEnd.which, { node: snap.node, side: snap.side }, true);
        } else if (snap?.point) {
          // 吸附到管道（其他边的最近点）
          p.onSetEdgeEnd?.(d.edgeEnd.edgeId, d.edgeEnd.which, { point: snap.point }, true);
        } else {
          // 松手在空白 → 最终自由点（光标世界坐标）
          const w = toWorld(vpRef.current, pos.sx, pos.sy);
          p.onSetEdgeEnd?.(d.edgeEnd.edgeId, d.edgeEnd.which, { point: [w.x, w.y] }, true);
        }
      }
      edgeSnapRef.current = null;
      if (d.moved) suppressClickRef.current = true;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if (d?.mode === "connect") {
      // 松手：落在其他图元上 → 提交连线；落空白/原图元 → 取消。
      // 提交判定用「按下点→松手点」净位移（非 d.moved 的 3px 微抖阈值）：误触端口的手抖/点按常超 3px
      // 但达不到这里，避免凭空多出一条线；真拖拽（意图明确）位移远超此阈值，不受影响。
      const pos = relPos(e);
      const movedFarEnough = !!pos && Math.hypot(pos.sx - d.sx0, pos.sy - d.sy0) >= CONNECT_COMMIT_PX;
      if (pos && d.nodeId && movedFarEnough) commitConnect(d.nodeId, d.fromSide, pos.sx, pos.sy);
      cancelConnect();
      if (d.moved) suppressClickRef.current = true;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if (d?.mode === "marquee") {
      if (d.moved) {
        const pos = relPos(e);
        if (pos) {
          const vp = vpRef.current;
          propsRef.current.onSelectMany(nodesInMarquee(hitBoxesRef.current, vp, d.sx0, d.sy0, pos.sx, pos.sy));
          propsRef.current.onSelectManyEdges?.(edgesInMarquee(edgePathsRef.current, vp, d.sx0, d.sy0, pos.sx, pos.sy));
        }
        suppressClickRef.current = true; // 抑制随后的 click 清空选择
      }
      setMarquee(null);
    } else if (d?.moved) {
      suppressClickRef.current = true; // 抑制随后的 click 选中
    }
    dragRef.current = null;
    if (alignGuidesRef.current) { alignGuidesRef.current = null; loopRef.current?.markDirty(); } // 收起对齐参考线
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 系统接管指针流（触摸手势/浏览器拖拽）后不会再来 pointerup：统一清空全部指针中间态——
    // 按住中的按钮（否则 pressed 视觉永久卡住且 pointermove 悬停门控被阻塞）、
    // 拖拽/框选/拉线（否则 marquee 浮层跟鼠标飘、橡皮筋残留，直到下一次 pointerdown 才被覆盖）。
    if (pressedActionRef.current) {
      pressedActionRef.current = null;
      loopRef.current?.markDirty();
    }
    if (dragRef.current) {
      dragRef.current = null;
      setMarquee(null);
      edgeSnapRef.current = null;
      alignGuidesRef.current = null;
    }
    cancelConnect();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return; // 本次 click 来自拖拽末端，不当作选中
    }
    const pos = relPos(event);
    if (!pos) return;
    const p = propsRef.current;
    const id = hitTest(hitBoxesRef.current, vpRef.current, pos.sx, pos.sy);
    if (id) {
      p.onSelect(id);
      p.onSelectEdge?.(null); // 选中节点时清边选（两种选择互斥）
      return;
    }
    // 未中节点 → 试命中连线（编辑态）：选中高亮，Del 可删；点空白两者皆清。
    const edgeId = p.onSelectEdge ? hitTestEdges(edgePathsRef.current, vpRef.current, pos.sx, pos.sy) : null;
    p.onSelect(null);
    p.onSelectEdge?.(edgeId);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // 双击按钮区（预览连点执行动作）不重置视口，只有空白/图元双击才适应视图。
    const pos = relPos(event);
    if (pos && actionHit(pos.sx, pos.sy)) return;
    applyFit();
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!propsRef.current.onContextMenu) return;
    e.preventDefault();
    const pos = relPos(e);
    if (!pos) return;
    const nodeId = hitTest(hitBoxesRef.current, vpRef.current, pos.sx, pos.sy);
    const w = toWorld(vpRef.current, pos.sx, pos.sy);
    propsRef.current.onContextMenu(e.clientX, e.clientY, w.x, w.y, nodeId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    // Esc 优先取消进行中的拉线/拖拽（不清选择）；否则交给上层（清选择等）。
    if (e.key === "Escape" && connectFromRef.current) {
      cancelConnect();
      dragRef.current = null;
      return;
    }
    const d = dragRef.current;
    if (e.key === "Escape" && d?.moved && (d.mode === "node" || d.mode === "group" || d.mode === "resize" || d.mode === "edge-end")) {
      props.onCancelDrag?.(); // 复原到拖拽前（history 弹回 begin 快照）
      edgeSnapRef.current = null;
      dragRef.current = null;
      loopRef.current?.markDirty();
      return;
    }
    props.onKeyDown?.(e);
  };

  const btn = "flex size-7 items-center justify-center rounded-sm border border-border bg-card/90 text-muted-foreground shadow-sm hover:text-foreground hover:bg-surface-inset";

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        tabIndex={0}
        role="application"
        className="block h-full w-full cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-focus-accent focus-visible:ring-inset active:cursor-grabbing"
        data-testid="hmi-canvas"
        aria-label={props.ariaLabel ?? t("工艺流程图，方向键在设备间移动，Esc 取消选择，滚轮缩放，拖动平移，编辑态 Shift+拖动框选")}
      />
      {marquee ? (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border border-focus-accent bg-focus-accent/10"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
          data-testid="marquee"
        />
      ) : null}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1" data-testid="canvas-controls">
        <button type="button" className={btn} onClick={() => zoomByFactor(1.25)} aria-label={t("放大")} title={t("放大")}>
          <Plus className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => zoomByFactor(0.8)} aria-label={t("缩小")} title={t("缩小")}>
          <Minus className="size-4" />
        </button>
        <button type="button" className={btn} onClick={applyFit} aria-label={t("适应视图")} title={t("适应视图（双击画布同效）")}>
          <Maximize2 className="size-4" />
        </button>
      </div>
    </div>
  );
});
