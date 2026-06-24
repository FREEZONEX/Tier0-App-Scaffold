import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct, liquidSurface } from "./fill";
import { formatInlineValue } from "./inline";
import { showDetail } from "./lod";

const W = 60;
const H = 80;
const DOME = 12; // 上下椭圆封头（弧）的曲率高度（压力容器辨识特征，替代旧的直边圆角矩形顶底）
const JACKET = 3.5; // 内侧夹套第二轮廓相对壳壁的内缩量（细节层）
const NOZ_H = 8; // 顶部搅拌口短管
const LEG_H = 12; // 底部支腿（细节层）
const LABEL_GAP = 18;

/**
 * 立式压力容器：搅拌反应釜(props.agitator=true) 或光面接收罐。
 * 造型：上下椭圆封头（path 弧）+ 内侧夹套第二轮廓（细节层）+ 顶部搅拌口短管 + 底部支腿（细节层）+ 液位裁剪。
 * 状态填充逻辑不变：静止=fillLight、运行=电机箱 fillDeep、液位=theme.liquid（裹在 clip 内）。
 */
export const vessel: SymbolDef = {
  type: "vessel",
  inlineFields: ["level"],
  // 命中框：上覆封头+搅拌口短管（agitator 时再加电机箱+22），下覆封头+支腿+位号。锚点 node.x/y 视觉居中于壳体。
  bounds: (node) => {
    const topEx = node.props?.agitator === true ? 22 + DOME : NOZ_H + DOME + 4;
    return { x: node.x - W / 2 - 8, y: node.y - H / 2 - topEx, w: W + 16, h: H + topEx + DOME + LEG_H + 4 };
  },
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const left = cx - W / 2;
    const right = cx + W / 2;
    const top = cy - H / 2;
    const bottom = top + H;
    const pct = fillPct(state, "level");
    const liquidH = (H * pct) / 100;
    const agitator = node.props?.agitator === true;
    const detail = showDetail(scale);

    // 釜体外轮廓：直筒侧壁 + 上下椭圆封头（path 二次贝塞尔弧），close 后填充。
    // 路径顺时针：左壁下行 → 底封头(下凸) → 右壁上行 → 顶封头(上凸) → 闭合。
    const bodyPath: Primitive = {
      kind: "path",
      d: [
        { c: "M", x: left, y: top },
        { c: "L", x: left, y: bottom },
        { c: "Q", x1: cx, y1: bottom + DOME * 1.6, x: right, y: bottom },
        { c: "L", x: right, y: top },
        { c: "Q", x1: cx, y1: top - DOME * 1.6, x: left, y: top },
      ],
      close: true,
      style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
    };

    const out: Primitive[] = [
      // 顶部搅拌口短管（基础形体：反应釜辨识特征，无 agitator 时也是接管口）
      { kind: "rect", x: cx - 5, y: top - DOME - NOZ_H + 2, w: 10, h: NOZ_H + 4, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
      bodyPath,
    ];

    if (liquidH > 0) {
      // 底封头先灌满（液体最先沉底——否则液面悬在直筒底、碟底空着，看着"没从底部开始"）。
      out.push({
        kind: "path",
        d: [
          { c: "M", x: left, y: bottom },
          { c: "Q", x1: cx, y1: bottom + DOME * 1.6, x: right, y: bottom },
        ],
        close: true,
        style: { fill: theme.liquid },
      });
      // 直筒段液位裁剪进矩形内（避免溢出弧形封头边界）；活数据 wave、stale 静态。
      out.push({
        kind: "clip",
        x: left, y: top, w: W, h: H,
        children: [liquidSurface({ x: left, y: bottom - liquidH, w: W, h: liquidH }, state.stale, theme.liquid)],
      });
    }

    if (detail) {
      // 夹套第二轮廓（细节层）：比壳壁内缩 JACKET 的同形描线（低对比 textMuted，缩小自然弱化）
      const jl = left + JACKET;
      const jr = right - JACKET;
      const jt = top + JACKET * 0.6;
      const jb = bottom - JACKET * 0.6;
      out.push({
        kind: "path",
        d: [
          { c: "M", x: jl, y: jt },
          { c: "L", x: jl, y: jb },
          { c: "Q", x1: cx, y1: jb + DOME * 1.2, x: jr, y: jb },
          { c: "L", x: jr, y: jt },
          { c: "Q", x1: cx, y1: jt - DOME * 1.2, x: jl, y: jt },
        ],
        close: true,
        style: { stroke: theme.textMuted, strokeWidth: 1 },
      });
      // 底部 2 支腿（细节层）
      out.push(
        { kind: "line", x1: left + W * 0.24, y1: bottom + DOME * 0.4, x2: left + W * 0.24 - 3, y2: bottom + DOME * 0.4 + LEG_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: right - W * 0.24, y1: bottom + DOME * 0.4, x2: right - W * 0.24 + 3, y2: bottom + DOME * 0.4 + LEG_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }

    // 进料口（左上）+ 出料口（底封头中心）
    out.push({ kind: "line", x1: left, y1: top + 10, x2: left - 8, y2: top + 10, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } });
    out.push({ kind: "line", x1: cx, y1: bottom + DOME * 0.4, x2: cx, y2: bottom + DOME * 0.4 + 8, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } });

    if (agitator) {
      // 顶置电机 + 轴 + 叶轮。运行态整组「点亮」：电机箱深填充 + 轴/叶轮染运行色加粗 + 叶轮两侧旋转弧；
      // 停止态全灰、无弧 —— 两态一眼可辨（状态必须映射到明显视觉，光靠小电机箱深浅太弱）。
      const run = state.running;
      const moving = run ? theme.running : theme.stroke; // 轴/叶轮：运行染绿
      const boxBottom = top - DOME - NOZ_H + 2;
      out.push({ kind: "rect", x: cx - 9, y: boxBottom - 14, w: 18, h: 14, r: 2, style: { fill: run ? theme.running : theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } });
      out.push({ kind: "line", x1: cx, y1: boxBottom, x2: cx, y2: cy + 18, style: { stroke: moving, strokeWidth: run ? 2.5 : 2 } }); // 搅拌轴
      out.push({ kind: "line", x1: cx - 12, y1: cy + 18, x2: cx + 12, y2: cy + 18, style: { stroke: moving, strokeWidth: run ? 3.5 : 2.5, lineCap: "round" } }); // 叶轮
      if (run) {
        // 旋转弧（运动指示，仅运行时出现）：叶轮两端各一道外扩弧，强化「搅拌在转」
        out.push(
          { kind: "path", d: [{ c: "M", x: cx - 15, y: cy + 12 }, { c: "Q", x1: cx - 21, y1: cy + 18, x: cx - 15, y: cy + 24 }], style: { stroke: theme.running, strokeWidth: 1.5, lineCap: "round" } },
          { kind: "path", d: [{ c: "M", x: cx + 15, y: cy + 12 }, { c: "Q", x1: cx + 21, y1: cy + 18, x: cx + 15, y: cy + 24 }], style: { stroke: theme.running, strokeWidth: 1.5, lineCap: "round" } },
        );
      }
    }

    // 搅拌器场景下，搅拌轴竖穿居中液位读数 → 给文字加 halo 衬底盖住轴线（无搅拌时不加，与 drum/tank 居中读数保持一致）。
    out.push({ kind: "text", x: cx, y: cy + 5, text: formatInlineValue("level", state.values.level, state.units?.level), style: { fill: theme.text, font: "600 16px ui-sans-serif, system-ui", textAlign: "center", ...(agitator ? { halo: theme.fillLight } : {}) } });
    out.push(...labelAndInline(node, state, theme, bottom + DOME + LEG_H + LABEL_GAP - 12));
    return out;
  },
};
