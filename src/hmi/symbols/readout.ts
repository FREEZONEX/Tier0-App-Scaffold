import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { formatInlineValue } from "./inline";

// 默认盒尺寸（命中/选择用静态包围盒；渲染盒按文字长度自适应，可略宽于此）。
const HW = 28; // 半宽
const HH = 10; // 半高
const CHAR_W = 6.5; // 字符宽估算（无 canvas 测量）
const PAD = 12; // 盒内左右留白

/**
 * 数值点（自由标注）：绑一个数值，渲染成一个浅底圆角小盒里的居中读数（越限变色）。
 * 可任意摆放、任意数量，叠在设备/管线上做精确多点位标记（如精馏塔各塔盘温度）。
 * 复用整套绑定（map/scale/alarms）；本身无运行态。位号/标签留在检视面板，画布只显值——
 * 与现场 DCS 一致，密集叠放不糊。
 */
export const readout: SymbolDef = {
  type: "readout",
  inlineFields: ["value"],
  overlay: true, // 标注层：盖在被标记的组件之上，自身盒即背景，无需不透明背板
  bounds: (node) => ({ x: node.x - HW, y: node.y - HH, w: HW * 2, h: HH * 2 }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const text = formatInlineValue("value", state.values.value, state.units?.value);
    const level = state.levels?.value ?? state.alarm;
    const color = level === "alarm" ? theme.alarm : level === "warn" ? theme.interlock : theme.text;
    const w = Math.max(HW * 2, text.length * CHAR_W + PAD);
    return [
      { kind: "rect", x: cx - w / 2, y: cy - HH, w, h: HH * 2, r: 3, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 1 } },
      { kind: "text", x: cx, y: cy + 4, text, style: { fill: color, font: "600 11px ui-sans-serif, system-ui", textAlign: "center" } },
    ];
  },
};
