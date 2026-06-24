import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { toBool } from "../shared/coerce";
import { showDetail } from "./lod";

// 角式安全阀/泄压阀(PSV)：方形阀体 + 侧面进口 + 朝上出口 + 顶部弹簧 + 杠杆配重柄。
// 阀体比例微调更挺拔（高>宽），强化 PSV 立式弹簧腔的辨识感。
const BW = 22; // 阀体宽（收窄）
const BH = 26; // 阀体高（拔高）→ 更挺拔
const HW = BW / 2;
const HH = BH / 2;
const INLET = 9; // 侧面进口管嘴长度
const OUTLET = 12; // 上出口管嘴长度
const SPRING_H = 16; // 弹簧 zigzag 高度
const SPRING_W = 6; // 弹簧 zigzag 半宽
const ARROW = 8; // 顶端泄压箭头臂长
const LEVER_DX = 18; // 杠杆配重柄水平伸出（细节层）
const LEVER_DY = 10; // 杠杆配重柄上抬高度（细节层）
const LEVER_BOB = 3; // 杆端配重小块半径

const isOpen = (values: Readonly<Record<string, unknown>>): boolean => toBool(values.open);

export const safetyvalve: SymbolDef = {
  type: "safetyvalve",
  lrOnly: true,
  inlineFields: ["open"],
  // 包围盒覆盖阀体 + 上出口 + 弹簧 + 顶端箭头（向上延伸最高），右侧留杠杆配重柄余量，左下留侧进口。
  bounds: (node) => ({
    x: node.x - HW - INLET - 2,
    y: node.y - HH - OUTLET - SPRING_H - ARROW - 2,
    w: (HW + INLET + 2) + (HW + LEVER_DX + LEVER_BOB + 2),
    h: (HH + OUTLET + SPRING_H + ARROW + 2) + (HH + 2),
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    // 开（泄压通路）= 深填充醒目；关（密封）= 浅填充。与泵/阀「激活=深填充」一致。
    const open = isOpen(state.values);
    const fill = open ? theme.running : theme.fillLight;
    const cx = node.x;
    const cy = node.y;
    const left = cx - HW;
    const top = cy - HH;
    const right = left + BW;
    const body = { fill, stroke: theme.stroke, strokeWidth: 2 };
    const stub = { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" as const };
    const spring = { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" as const };
    const detailLine = { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" as const };
    const detail = showDetail(scale);

    // 出口管嘴起点（阀体顶边中心向上），弹簧坐在出口管嘴之上
    const outletTopY = top - OUTLET;
    const springTopY = outletTopY - SPRING_H;
    const arrowTipY = springTopY - ARROW;

    const out: Primitive[] = [
      // 侧面进口管嘴（水平，左侧）——坐实"在线泄压元件"
      { kind: "line", x1: left - INLET, y1: cy, x2: left, y2: cy, style: stub },
      // 朝上出口管嘴（垂直，顶部）——PSV 辨识特征：泄压口朝上排放
      { kind: "line", x1: cx, y1: top, x2: cx, y2: outletTopY, style: stub },
      // 阀体（方块），open 时 fillDeep
      { kind: "rect", x: left, y: top, w: BW, h: BH, r: 2, style: body },
      // 顶部弹簧符号（zigzag polyline）——PSV 辨识特征：弹簧加载
      {
        kind: "polyline",
        points: [
          [cx, outletTopY],
          [cx - SPRING_W, outletTopY - SPRING_H * 0.25],
          [cx + SPRING_W, outletTopY - SPRING_H * 0.5],
          [cx - SPRING_W, outletTopY - SPRING_H * 0.75],
          [cx, springTopY],
        ],
        style: spring,
      },
      // 顶端向上箭头：表示泄压排放方向
      { kind: "line", x1: cx, y1: springTopY, x2: cx, y2: arrowTipY, style: spring },
      {
        kind: "polyline",
        points: [
          [cx - 4, arrowTipY + 5],
          [cx, arrowTipY],
          [cx + 4, arrowTipY + 5],
        ],
        style: spring,
      },
    ];

    if (detail) {
      // 细节层：从阀顶斜伸的杠杆配重柄（手动提升杠杆，PSV/带杠杆安全阀辨识件）+ 杆端配重小块。
      // 从阀体右上角顶边引出，向右上斜抬。
      const hingeX = right;
      const hingeY = top + 3;
      const tipX = hingeX + LEVER_DX;
      const tipY = hingeY - LEVER_DY;
      out.push(
        { kind: "line", x1: hingeX, y1: hingeY, x2: tipX, y2: tipY, style: detailLine },
        { kind: "circle", cx: tipX, cy: tipY, r: LEVER_BOB, style: detailLine },
      );
    }

    out.push(...labelAndInline(node, state, theme, cy + HH + 16));
    return out;
  },
};
