import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { fillPct } from "./fill";
import { formatInlineValue } from "./inline";

// 壳体保持 W64×H104（液位测试与整图布局依赖此 footprint）。
const W = 64;
const H = 104;
const DOME_H = 16; // 拱顶（椭圆弧封头）高出壳体顶
const TOP_RESERVE = 8; // 拱顶上方留白（位号/命中框用）
const LABEL_GAP = 8;

export const tank: SymbolDef = {
  type: "tank",
  inlineFields: ["level"],
  // 命中框：上覆拱顶+位号。锚点 node.x/y 视觉居中于壳体。
  bounds: (node) => ({
    x: node.x - W / 2,
    y: node.y - H / 2 - (DOME_H + TOP_RESERVE + LABEL_GAP + 12),
    w: W,
    h: H + (DOME_H + TOP_RESERVE + LABEL_GAP + 12),
  }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const top = node.y - H / 2;
    const right = left + W;
    const apex = top - DOME_H;
    const pct = fillPct(state, "level");
    const liquidH = (H * pct) / 100;
    const out: Primitive[] = [
      // 拱顶：椭圆弧封头（贝塞尔），close 后填充
      {
        kind: "path",
        d: [
          { c: "M", x: left, y: top },
          { c: "C", x1: left + W * 0.1, y1: top - DOME_H * 1.4, x2: right - W * 0.1, y2: top - DOME_H * 1.4, x: right, y: top },
        ],
        close: true,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 壳体：干净圆角矩形（去顶部接管方块/壁面焊缝/支腿，简洁为先）
      { kind: "rect", x: left, y: top, w: W, h: H, r: 3, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    if (liquidH > 0) {
      // 液面 y（液位高度对应的水面）。裁剪到罐体圆角矩形内，避免底部方角溢出圆角。
      const surfaceY = top + (H - liquidH);
      // 活数据→液面轻微波动（wave，振幅~1.6px）；失联(stale)→静态平面冻结（rect）——「在动」编码「数据新鲜」。
      const liquid: Primitive = state.stale
        ? { kind: "rect", x: left, y: surfaceY, w: W, h: liquidH, style: { fill: theme.liquid } }
        : { kind: "wave", x: left, y: surfaceY, w: W, h: liquidH, amp: 1.6, wavelength: W, period: 2600, style: { fill: theme.liquid } };
      out.push({ kind: "clip", x: left, y: top, w: W, h: H, r: 3, children: [liquid] });
    }
    out.push({ kind: "text", x: node.x, y: node.y + 5, text: formatInlineValue("level", state.values.level, state.units?.level), style: { fill: theme.text, font: "600 18px ui-sans-serif, system-ui", textAlign: "center" } });
    if (node.label) {
      out.push({ kind: "text", x: node.x, y: apex - LABEL_GAP, text: node.label, style: { fill: theme.textMuted, font: "11px ui-sans-serif, system-ui", textAlign: "center" } });
    }
    return out;
  },
};
