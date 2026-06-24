import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct } from "./fill";
import { showDetail } from "./lod";

const W = 32; // 上部圆柱段宽（旋风体直径）
const CYL_H = 24; // 上部短圆柱段高
const CONE_H = 50; // 下部细长倒锥体高（锥长 ≈ 2×柱高 = 旋风分离器辨识特征）
const TIP_W = 8; // 锥底卸料口宽（不收到一点，留卸料管嘴）
const FINDER_H = 14; // 顶部升气管（vortex finder）外伸高
const FINDER_W = 8; // 升气管管径
const INLET_W = 14; // 切向入口矩形横向长度（贴左上、伸出本体左缘）
const INLET_H = 7; // 切向入口矩形高
const NOZZLE = 8; // 锥底卸料管嘴长

/**
 * 旋风分离器：上部短圆柱(矩形 r2) + 下部细长倒锥体(polygon，锥长 ≈ 2×柱高，长锥是辨识特征) +
 * 顶部升气管(vortex finder，中心向上伸出的短管 rect) + 切向入口矩形(贴左上、伸出本体左缘) +
 * 锥底卸料口短管。本体 fillLight + theme.stroke。料位按 state.values.level 用
 * clip 在圆柱段画(theme.liquid)。细节层(showDetail)追加锥内旋流弧 + 圆柱/锥交界焊缝细线。
 */
export const cyclone: SymbolDef = {
  type: "cyclone",
  inlineFields: ["level"],
  bounds: (node) => ({
    x: node.x - W / 2 - INLET_W, // 含切向入口矩形横向外延
    y: node.y - CYL_H / 2 - FINDER_H,
    w: W + INLET_W,
    h: CYL_H + CONE_H + FINDER_H + NOZZLE,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const left = cx - W / 2;
    const right = cx + W / 2;
    const cylTop = node.y - CYL_H / 2; // 圆柱段顶
    const cylBottom = cylTop + CYL_H; // 圆柱段底 = 锥体口
    const coneTip = cylBottom + CONE_H; // 锥体尖底（卸料口顶）
    const pct = fillPct(state, "level");
    const liquidH = (CYL_H * pct) / 100;
    const detail = showDetail(scale);

    const out: Primitive[] = [
      // 顶部升气管（vortex finder）= 辨识特征之一：中心向上伸出的短管 rect
      {
        kind: "rect",
        x: cx - FINDER_W / 2,
        y: cylTop - FINDER_H,
        w: FINDER_W,
        h: FINDER_H + 4,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 切向入口矩形（贴左上、横向伸出本体左缘）= 辨识特征之一
      {
        kind: "rect",
        x: left - INLET_W,
        y: cylTop + 3,
        w: INLET_W + 2,
        h: INLET_H,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 上部短圆柱段
      { kind: "rect", x: left, y: cylTop, w: W, h: CYL_H, r: 2, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];

    // 料位：裁到圆柱段圆角内，介质用 theme.liquid（状态层，任何缩放都画）
    if (liquidH > 0) {
      out.push({
        kind: "clip",
        x: left,
        y: cylTop,
        w: W,
        h: CYL_H,
        r: 2,
        children: [{ kind: "rect", x: left, y: cylBottom - liquidH, w: W, h: liquidH, style: { fill: theme.liquid } }],
      });
    }

    // 下部细长倒锥体（长锥）= 旋风分离器最强辨识特征；锥底留卸料口宽 TIP_W（不收到一点）
    out.push({
      kind: "polygon",
      points: [
        [left, cylBottom],
        [right, cylBottom],
        [cx + TIP_W / 2, coneTip],
        [cx - TIP_W / 2, coneTip],
      ],
      style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
    });

    // 锥底卸料管嘴
    out.push({ kind: "line", x1: cx, y1: coneTip, x2: cx, y2: coneTip + NOZZLE, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } });

    if (detail) {
      // 细节层：锥内旋流弧（两段 Q 贝塞尔，示意离心螺旋下行）+ 圆柱/锥交界焊缝细线。
      // 低对比 textMuted、细线，缩小自然弱化，绝不抢异常色。
      const swirlTop = cylBottom + CONE_H * 0.18;
      const swirlBottom = cylBottom + CONE_H * 0.78;
      out.push(
        {
          kind: "path",
          d: [
            { c: "M", x: cx - W * 0.34, y: swirlTop },
            { c: "Q", x1: cx + W * 0.28, y1: cylBottom + CONE_H * 0.42, x: cx - W * 0.14, y: cylBottom + CONE_H * 0.58 },
            { c: "Q", x1: cx + W * 0.12, y1: swirlBottom, x: cx - TIP_W * 0.3, y: swirlBottom + CONE_H * 0.08 },
          ],
          style: { stroke: theme.textMuted, strokeWidth: 1.25 },
        },
        // 圆柱段 / 锥体交界焊缝横细线
        { kind: "line", x1: left + 1, y1: cylBottom, x2: right - 1, y2: cylBottom, style: { stroke: theme.textMuted, strokeWidth: 1 } },
      );
    }

    out.push(...labelAndInline(node, state, theme, coneTip + NOZZLE + 16));
    return out;
  },
};
