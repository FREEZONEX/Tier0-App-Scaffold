import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct } from "./fill";
import { formatInlineValue } from "./inline";
import { showDetail } from "./lod";

const W = 48; // 上部圆柱仓体宽
const BODY_H = 72; // 上部圆柱仓体高（料位裁剪段）
const CONE_H = 30; // 下部 60° 锥斗高（半宽 24 / tan30°≈41 偏陡，取 30 兼顾 bounds）
const NOZZLE = 8; // 顶/底中心短管长
const SEAM_W = 1; // 焊缝/管箍细线
const LEG_OUT = 4; // 锥斗两侧斜撑外伸
const LEG_DROP = 12; // 支腿落地深度

/**
 * 料仓/料斗（固体储料）：上部圆柱仓体 + 下部 60° 锥斗（倒三角 polygon 收口）。
 * 锥形料斗 + 卸料短管是与储罐(tank/vessel)的辨识区别。料位按 state.values.level 用
 * clip 裁到圆柱仓体内，料位用 theme.liquid（与全库容器一致）。
 * 细节层（showDetail）补：3 支腿画 2（锥斗两侧斜撑）、顶部除尘口短管、壁面管箍细线。
 * 状态层（料位）任何缩放都画；异常色由上层装饰层负责，symbol 不画。
 */
export const silo: SymbolDef = {
  type: "silo",
  inlineFields: ["level"],
  bounds: (node) => ({
    x: node.x - W / 2 - LEG_OUT,
    y: node.y - BODY_H / 2 - NOZZLE,
    w: W + LEG_OUT * 2,
    h: BODY_H + CONE_H + NOZZLE * 2 + LEG_DROP,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const left = cx - W / 2;
    const right = cx + W / 2;
    const top = node.y - BODY_H / 2; // 圆柱仓体顶
    const bodyBottom = top + BODY_H; // 圆柱仓体底 = 锥斗口
    const coneTip = bodyBottom + CONE_H; // 锥斗尖底
    const pct = fillPct(state, "level");
    const liquidH = (BODY_H * pct) / 100;
    const detail = showDetail(scale);

    const out: Primitive[] = [
      // 上部圆柱仓体（基础形体）
      { kind: "rect", x: left, y: top, w: W, h: BODY_H, r: 3, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];

    // 料位（状态层）：裁到圆柱仓体圆角内，料位用 theme.liquid（与全库容器 tank/drum/vessel/column/cyclone 一致），任何缩放都画
    if (liquidH > 0) {
      out.push({
        kind: "clip",
        x: left,
        y: top,
        w: W,
        h: BODY_H,
        r: 3,
        children: [{ kind: "rect", x: left, y: bodyBottom - liquidH, w: W, h: liquidH, style: { fill: theme.liquid } }],
      });
    }

    // 下部 60° 锥斗 = 料仓辨识特征（倒三角 polygon 收口）
    out.push({
      kind: "polygon",
      points: [
        [left, bodyBottom],
        [right, bodyBottom],
        [cx, coneTip],
      ],
      style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
    });

    // 锥斗底部卸料短管（基础形体：料仓辨识特征）
    out.push({ kind: "line", x1: cx, y1: coneTip, x2: cx, y2: coneTip + NOZZLE, style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } });

    if (detail) {
      // 细节层（低对比 textMuted，缩小自然弱化）：
      // 顶部除尘口短管 + 圆柱壁面管箍细线 + 3 支腿画 2（锥斗两侧斜撑）
      out.push(
        // 顶部除尘口短管（细线短管）
        { kind: "line", x1: cx, y1: top, x2: cx, y2: top - NOZZLE, style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" } },
        // 圆柱壁面管箍 2 道横细线
        { kind: "line", x1: left, y1: top + BODY_H / 3, x2: right, y2: top + BODY_H / 3, style: { stroke: theme.textMuted, strokeWidth: SEAM_W } },
        { kind: "line", x1: left, y1: top + (2 * BODY_H) / 3, x2: right, y2: top + (2 * BODY_H) / 3, style: { stroke: theme.textMuted, strokeWidth: SEAM_W } },
        // 锥斗两侧斜撑支腿（3 支腿画 2）：从锥斗口外沿斜向落地
        { kind: "line", x1: left, y1: bodyBottom, x2: left - LEG_OUT, y2: bodyBottom + LEG_DROP, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: right, y1: bodyBottom, x2: right + LEG_OUT, y2: bodyBottom + LEG_DROP, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }

    out.push({ kind: "text", x: cx, y: node.y + 5, text: formatInlineValue("level", state.values.level, state.units?.level), style: { fill: theme.text, font: "600 15px ui-sans-serif, system-ui", textAlign: "center" } });
    out.push(...labelAndInline(node, state, theme, coneTip + LEG_DROP + 16));
    return out;
  },
};
