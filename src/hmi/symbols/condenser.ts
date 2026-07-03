import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

// 立式冷凝器：竖壳体（圆柱筒）+ 上下椭圆封头（path 椭圆弧，区别于卧式换热器的卧筒）。
// 顶部大管嘴 = 汽相入口；底部小管嘴 = 冷凝液出口；内部 3~4 根竖细线 = 管束（细节层）。
// 锚点 node.x/y 视觉居中于筒体；running 时筒体深填充（与静止区分）。
const W = 34; // 筒体宽
const H = 56; // 筒体（直筒段）高
const HEAD_H = 9; // 上下椭圆封头弧高（凸出筒体顶/底）
const IN_W = 14; // 顶部汽入口大管嘴宽
const IN_H = 9; // 顶部汽入口大管嘴高
const OUT_W = 7; // 底部液出口小管嘴宽
const OUT_H = 7; // 底部液出口小管嘴高
const LABEL_GAP = 8;
const TUBE_INSET = 6; // 管束竖线相对筒壁的内缩
const TUBE_PAD_Y = 4; // 管束竖线相对封头切点的竖向余量

export const condenser: SymbolDef = {
  type: "condenser",
  inlineFields: ["temp"],
  // 命中框：上覆封头+汽入口管嘴，下覆封头+液出口管嘴+位号+内联值。锚点仍居中于筒体。
  bounds: (node) => ({
    x: node.x - W / 2,
    y: node.y - H / 2 - (HEAD_H + IN_H + 4),
    w: W,
    h: H + (HEAD_H + IN_H + 4) + (HEAD_H + OUT_H + LABEL_GAP + 4 + 28),
  }),
  // 真实图形轮廓（不含 bounds 里为下方文字多留的 +LABEL_GAP+4+28）：选中环/动作按钮据此贴合壳体+管嘴。
  coreBox: (node) => ({
    x: node.x - W / 2,
    y: node.y - H / 2 - (HEAD_H + IN_H + 4),
    w: W,
    h: H + (HEAD_H + IN_H + 4) + (HEAD_H + OUT_H),
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const left = cx - W / 2;
    const right = cx + W / 2;
    const top = node.y - H / 2;
    const bottom = top + H;
    const headTop = top - HEAD_H; // 上封头顶点
    const headBot = bottom + HEAD_H; // 下封头底点
    const fill = state.running ? theme.running : theme.fillLight;
    const detail = showDetail(scale);
    const shell = { fill, stroke: theme.stroke, strokeWidth: 2 };

    const out: Primitive[] = [
      // 上椭圆封头（椭圆弧 path：从左切点经顶点到右切点，close 后填充）
      {
        kind: "path",
        d: [
          { c: "M", x: left, y: top },
          { c: "C", x1: left + W * 0.08, y1: headTop - HEAD_H * 0.2, x2: right - W * 0.08, y2: headTop - HEAD_H * 0.2, x: right, y: top },
        ],
        close: true,
        style: shell,
      },
      // 下椭圆封头（向下凸）
      {
        kind: "path",
        d: [
          { c: "M", x: left, y: bottom },
          { c: "C", x1: left + W * 0.08, y1: headBot + HEAD_H * 0.2, x2: right - W * 0.08, y2: headBot + HEAD_H * 0.2, x: right, y: bottom },
        ],
        close: true,
        style: shell,
      },
      // 筒体直段
      { kind: "rect", x: left, y: top, w: W, h: H, style: shell },
      // 顶部汽相入口（大管嘴）
      { kind: "rect", x: cx - IN_W / 2, y: headTop - IN_H, w: IN_W, h: IN_H + 4, style: shell },
      // 底部冷凝液出口（小管嘴）
      { kind: "rect", x: cx - OUT_W / 2, y: headBot - 4, w: OUT_W, h: OUT_H + 4, style: shell },
    ];

    if (detail) {
      // 细节层：内部管束 4 根竖细线（低对比 textMuted，缩小自然弱化）+ 封头与筒体的切线缝
      const tubeTop = top + TUBE_PAD_Y;
      const tubeBot = bottom - TUBE_PAD_Y;
      const innerL = left + TUBE_INSET;
      const innerR = right - TUBE_INSET;
      const span = innerR - innerL;
      const tube = { stroke: theme.textMuted, strokeWidth: 1 };
      for (let i = 0; i < 4; i++) {
        const x = innerL + (span * i) / 3;
        out.push({ kind: "line", x1: x, y1: tubeTop, x2: x, y2: tubeBot, style: tube });
      }
      // 上/下封头切线焊缝
      out.push(
        { kind: "line", x1: left, y1: top, x2: right, y2: top, style: { stroke: theme.textMuted, strokeWidth: 1 } },
        { kind: "line", x1: left, y1: bottom, x2: right, y2: bottom, style: { stroke: theme.textMuted, strokeWidth: 1 } },
      );
    }

    // 位号 + 内联实时值排在底部管嘴下方（labelAndInline：位号 belowY、值 belowY+14）。
    out.push(...labelAndInline(node, state, theme, headBot + OUT_H + LABEL_GAP + 4));
    return out;
  },
};
