import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct, liquidSurface } from "./fill";
import { formatInlineValue } from "./inline";
import { showDetail } from "./lod";

// 壳体保持 W96×H44（液位测试与整图布局依赖此 footprint；造型升级不改尺寸）。
const W = 96;
const H = 44;
const R = H / 2; // = 22 → 左右两端整半圆封头，坐实"卧式胶囊"轮廓
const NOZ_H = 10; // 顶部气相接管短管 / 左右进出管嘴外伸长度
const SADDLE_H = 9; // 底部鞍座（细节层）高度
const SADDLE_W = 22; // 鞍座底脚宽
const SEAM_W = 1; // 封头与壳体之间的接缝细线

/**
 * 卧式分离罐/缓冲罐：水平胶囊——左右两端半圆封头（path A 弧）+ 中段矩形壳体；
 * 底部 2 鞍座托住罐底（细节层）、顶部气相接管短管、左右进出管嘴；液位裁剪进卧式壳体轮廓内。
 */
export const drum: SymbolDef = {
  type: "drum",
  inlineFields: ["level"],
  // 命中框：上覆顶部接管，下覆鞍座。锚点 node.x/y 仍视觉居中于壳体。
  bounds: (node) => ({
    x: node.x - W / 2,
    y: node.y - H / 2 - NOZ_H,
    w: W,
    h: H + NOZ_H + SADDLE_H,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const left = cx - W / 2;
    const top = cy - H / 2;
    const right = left + W;
    const bottom = top + H;
    // 封头/壳体的分界圆心（左右半圆与中段矩形相切处）
    const headLeftCx = left + R;
    const headRightCx = right - R;
    const pct = fillPct(state, "level");
    const liquidH = (H * pct) / 100;
    const detail = showDetail(scale);

    const out: Primitive[] = [
      // 卧式胶囊壳体：中段直壁 + 左右两端半圆封头，path 一笔勾出闭合轮廓（外轮廓 strokeWidth 2）
      {
        kind: "path",
        d: [
          { c: "M", x: headLeftCx, y: top },
          { c: "L", x: headRightCx, y: top },
          // 右端封头：上→下半圆（canvas arc 默认顺时针，从 -90° 到 90°）
          { c: "A", cx: headRightCx, cy, r: R, a0: -Math.PI / 2, a1: Math.PI / 2 },
          { c: "L", x: headLeftCx, y: bottom },
          // 左端封头：下→上半圆（从 90° 到 270°）
          { c: "A", cx: headLeftCx, cy, r: R, a0: Math.PI / 2, a1: (3 * Math.PI) / 2 },
        ],
        close: true,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
    ];

    if (liquidH > 0) {
      // 底部液位裁剪进胶囊轮廓（圆角 r=R 的矩形即为卧式胶囊形），避免方角溢出两端封头
      out.push({
        kind: "clip",
        x: left,
        y: top,
        w: W,
        h: H,
        r: R,
        children: [liquidSurface({ x: left, y: bottom - liquidH, w: W, h: liquidH }, state.stale, theme.liquid)],
      });
    }

    // 左右进出管嘴（在线元件特征：短管嘴接入工艺管线）
    out.push({ kind: "line", x1: left, y1: cy, x2: left - NOZ_H, y2: cy, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } });
    out.push({ kind: "line", x1: right, y1: cy, x2: right + NOZ_H, y2: cy, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } });

    if (detail) {
      // 细节层：左右封头接缝竖细线 + 底部 2 鞍座（低对比 textMuted，缩小自然弱化）
      out.push(
        { kind: "line", x1: headLeftCx, y1: top, x2: headLeftCx, y2: bottom, style: { stroke: theme.textMuted, strokeWidth: SEAM_W } },
        { kind: "line", x1: headRightCx, y1: top, x2: headRightCx, y2: bottom, style: { stroke: theme.textMuted, strokeWidth: SEAM_W } },
      );
      // 鞍座：罐底两侧梯形托座（上窄贴罐壁、下宽落地），用 path 勾边
      for (const sx of [left + W * 0.28, right - W * 0.28]) {
        out.push({
          kind: "path",
          d: [
            { c: "M", x: sx - SADDLE_W / 4, y: bottom - 2 },
            { c: "L", x: sx - SADDLE_W / 2, y: bottom + SADDLE_H },
            { c: "L", x: sx + SADDLE_W / 2, y: bottom + SADDLE_H },
            { c: "L", x: sx + SADDLE_W / 4, y: bottom - 2 },
          ],
          style: { stroke: theme.textMuted, strokeWidth: 1.25 },
        });
      }
    }

    out.push({ kind: "text", x: cx, y: cy + 5, text: formatInlineValue("level", state.values.level, state.units?.level), style: { fill: theme.text, font: "600 15px ui-sans-serif, system-ui", textAlign: "center" } });
    out.push(...labelAndInline(node, state, theme, bottom + SADDLE_H + 12));
    return out;
  },
};
