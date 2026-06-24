import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { toBool } from "../shared/coerce";
import { showDetail } from "./lod";

const HW = 16; // 半宽
const HH = 13; // 半高
const STEM_H = 11; // 阀杆：自蝶形顶（cy-HH）向上竖线高度（细节层）
const WHEEL_HW = 7; // 顶部手轮：横线帽半宽（细节层）

const isOpen = (values: Readonly<Record<string, unknown>>): boolean => toBool(values.open ?? values.running);

export const valve: SymbolDef = {
  type: "valve",
  lrOnly: true,
  inlineFields: ["open"],
  // 命中框：上覆阀杆+手轮（STEM_H+2），左右覆两侧管段接头，下沿留与旧版一致。
  bounds: (node) => ({
    x: node.x - HW - 2,
    y: node.y - HH - 2 - (STEM_H + 2),
    w: (HW + 2) * 2,
    h: (HH + 2) * 2 + (STEM_H + 2),
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    // 开（通路/激活）= 深填充醒目；关（阻断）= 浅填充。与泵「运行=深填充」一致：激活态更醒目。
    const fill = isOpen(state.values) ? theme.running : theme.fillLight;
    const cx = node.x;
    const cy = node.y;
    const detail = showDetail(scale);
    const style = { fill, stroke: theme.stroke, strokeWidth: 2 };
    const stub = { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" as const };
    const out: Primitive[] = [
      // 两侧管段接头：坐实"在线流通元件"
      { kind: "line", x1: cx - HW - 7, y1: cy, x2: cx - HW, y2: cy, style: stub },
      { kind: "line", x1: cx + HW, y1: cy, x2: cx + HW + 7, y2: cy, style: stub },
      // 蝶形双三角（沙漏）：两枚三角在中心对顶
      { kind: "polygon", points: [[cx - HW, cy - HH], [cx - HW, cy + HH], [cx, cy]], style },
      { kind: "polygon", points: [[cx + HW, cy - HH], [cx + HW, cy + HH], [cx, cy]], style },
    ];
    if (detail) {
      // 细节层：阀杆（中心向上竖线）+ 顶部手轮（横线帽），低对比 textMuted，缩小自然弱化
      const stemTop = cy - HH - STEM_H;
      out.push(
        { kind: "line", x1: cx, y1: cy - HH, x2: cx, y2: stemTop, style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" as const } },
        { kind: "line", x1: cx - WHEEL_HW, y1: stemTop, x2: cx + WHEEL_HW, y2: stemTop, style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" as const } },
      );
    }
    out.push(...labelAndInline(node, state, theme, cy + HH + 16));
    return out;
  },
};
