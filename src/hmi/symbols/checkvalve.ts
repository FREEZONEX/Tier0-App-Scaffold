import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { toBool } from "../shared/coerce";
import { showDetail } from "./lod";

const R = 16; // 阀体半径（外接圆，circular 命中沿用）
const STUB = 8; // 管嘴长度
const TRI = 11; // 双三角半高（阀座对顶三角）

const isOpen = (values: Readonly<Record<string, unknown>>): boolean => toBool(values.open ?? values.running);

export const checkvalve: SymbolDef = {
  type: "checkvalve",
  lrOnly: true,
  inlineFields: ["open"],
  circular: true,
  bounds: (node) => ({ x: node.x - R - STUB - 2, y: node.y - R - 2, w: (R + STUB + 2) * 2, h: (R + 2) * 2 }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const open = isOpen(state.values);
    const detail = showDetail(scale);
    // 状态映射到整个阀体（与 valve 一致，两态区别醒目）：通路=阀体深填充·醒目，阻断=浅填充。
    // 方向三角随底色反相显示，保证在任一底色上都看得清，并继续指示流向。
    const bodyFill = open ? theme.running : theme.fillLight;
    const stub = { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" as const };
    const arrowStyle = open ? { fill: theme.fillLight } : { stroke: theme.stroke, strokeWidth: 2 };
    const out: Primitive[] = [
      // 左右管嘴：坐实在线单向流通元件
      { kind: "line", x1: cx - R - STUB, y1: cy, x2: cx - R, y2: cy, style: stub },
      { kind: "line", x1: cx + R, y1: cy, x2: cx + R + STUB, y2: cy, style: stub },
      // 圆形阀体（状态填充）
      { kind: "circle", cx, cy, r: R, style: { fill: bodyFill, stroke: theme.stroke, strokeWidth: 2 } },
      // 阀座双三角（对顶/沙漏，止回阀标志形体）：左三角朝右收口 = 阀座，右三角作流向指示
      // 左侧阀座三角：底边贴左、尖点指向圆心（仅描边，恒为座体）
      {
        kind: "polygon",
        points: [
          [cx - 9, cy - TRI],
          [cx - 9, cy + TRI],
          [cx, cy],
        ],
        style: { stroke: theme.stroke, strokeWidth: 2 },
      },
      // 右侧方向三角：尖点朝右（流向），状态填充
      {
        kind: "polygon",
        points: [
          [cx, cy - TRI],
          [cx, cy + TRI],
          [cx + 9, cy],
        ],
        style: arrowStyle,
      },
    ];
    if (detail) {
      // 细节层：铰链摆瓣 = 一条斜短线（摆瓣）+ 铰点小圆，低对比 textMuted，缩小自然弱化
      // 铰点位于阀体上沿，摆瓣斜垂向座口
      const hingeX = cx;
      const hingeY = cy - R + 2;
      out.push(
        // 摆瓣：自铰点斜垂下的短线
        {
          kind: "line",
          x1: hingeX,
          y1: hingeY,
          x2: hingeX - 5,
          y2: cy + 4,
          style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" },
        },
        // 铰点小圆
        { kind: "circle", cx: hingeX, cy: hingeY, r: 1.6, style: { fill: theme.textMuted } },
      );
    }
    out.push(...labelAndInline(node, state, theme, cy + R + 16));
    return out;
  },
};
