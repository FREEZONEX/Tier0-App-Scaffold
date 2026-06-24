import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { toFiniteNumber } from "../shared/coerce";
import { fillPct, liquidSurface } from "./fill";
import { showDetail } from "./lod";

// 瘦高塔体：细长比 H/W = 150/40 = 3.75（≥3.5，精馏塔典型高瘦轮廓）。
const W = 40;
const H = 150;
const BOT_R = W / 2; // 上下半圆封头半径（=20，碟顶/碟底，对称）
const NOZ_W = 8; // 侧面进料/回流管嘴宽（细节层）
const NOZ_H = 6; // 侧面管嘴高
const LABEL_GAP = 10;

/** 塔盘条数：塔内等距横向线，精馏塔/塔器的辨识特征（细节层）。 */
const TRAY_COUNT = 5;

/** 贴身读数格式化：数值留 1 位小数 + 可选单位，空/非数回落占位。 */
function formatReadout(v: unknown, unit?: string): string {
  const num = Number(v);
  if (Number.isFinite(num)) {
    const s = String(Math.round(num * 10) / 10);
    return unit ? `${s}${unit}` : s;
  }
  return v == null || v === "" ? "—" : String(v);
}

/**
 * 立式精馏塔/塔器：瘦高直筒塔体 + 顶椭圆封头 + 底部半圆碟底（path A 弧）。
 * 直筒段内画塔釜液位（裹在 clip 内）；细节层加等距塔盘线与左右进料/回流管嘴。
 * 锚点 node.x/y 视觉居中于直筒段。
 */
export const column: SymbolDef = {
  type: "column",
  inlineFields: ["temp"],
  // 命中框：上覆顶封头，下覆半圆碟底+位号；左右覆侧管嘴。锚点仍居中于直筒段。
  bounds: (node) => ({
    x: node.x - W / 2 - NOZ_W,
    y: node.y - H / 2 - BOT_R,
    w: W + NOZ_W * 2,
    h: H + BOT_R * 2 + LABEL_GAP + 14,
  }),
  // 连接盒 = 圆筒直径（含上下封头，**不含外凸侧管嘴**）：连线收口贴圆筒壁，避免收口到管嘴区
  // (bodyBBox 含管嘴外延)、在非管嘴高度露出画布色空隙。背板用本体剪影，非管嘴处本就贴圆筒。
  coreBox: (node) => ({ x: node.x - W / 2, y: node.y - H / 2 - BOT_R, w: W, h: H + BOT_R * 2 }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const left = cx - W / 2;
    const right = left + W;
    const top = cy - H / 2; // 直筒段顶
    const bottom = top + H; // 直筒段底
    const base = bottom + BOT_R; // 底半圆最低点
    const pct = fillPct(state, "level");
    const liquidH = (H * pct) / 100;
    const detail = showDetail(scale);

    const out: Primitive[] = [
      // 顶封头：半圆碟顶（向上外凸的半圆 A 弧），与底对称
      {
        kind: "path",
        d: [
          { c: "M", x: left, y: top },
          { c: "A", cx, cy: top, r: BOT_R, a0: Math.PI, a1: 2 * Math.PI, ccw: false },
        ],
        close: true,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 底封头：半圆碟底（向下外凸的半圆，arc 一笔；替代旧椭圆底+裙座，更简洁）
      {
        kind: "path",
        d: [
          { c: "M", x: right, y: bottom },
          { c: "A", cx, cy: bottom, r: BOT_R, a0: 0, a1: Math.PI, ccw: false },
        ],
        close: true,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 直筒塔身（fillLight 静止本体）
      { kind: "rect", x: left, y: top, w: W, h: H, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];

    // 塔釜液位：底碟封头先灌满（液体沉底，液面从视觉底起）+ 直筒段液位（wave/静态）裁进直筒矩形。
    if (liquidH > 0) {
      out.push({
        kind: "path",
        d: [
          { c: "M", x: right, y: bottom },
          { c: "A", cx, cy: bottom, r: BOT_R, a0: 0, a1: Math.PI, ccw: false },
        ],
        close: true,
        style: { fill: theme.liquid },
      });
      out.push({
        kind: "clip",
        x: left, y: top, w: W, h: H,
        children: [liquidSurface({ x: left, y: bottom - liquidH, w: W, h: liquidH }, state.stale, theme.liquid)],
      });
    }

    if (detail) {
      // 等距横向塔盘线（细线 textMuted）= 塔器辨识特征；分布在直筒段内
      const trayTop = top + H * 0.18;
      const trayBottom = bottom - H * 0.18;
      const gap = (trayBottom - trayTop) / (TRAY_COUNT - 1);
      for (let i = 0; i < TRAY_COUNT; i++) {
        const ty = trayTop + gap * i;
        out.push({ kind: "line", x1: left + 2, y1: ty, x2: right - 2, y2: ty, style: { stroke: theme.textMuted, strokeWidth: 1 } });
      }
      // 侧面进料/回流 2 短管：左右各一小矩形管嘴（细节层）
      const feedY = top + H * 0.32; // 上部回流口（左）
      const refluxY = top + H * 0.62; // 下部进料口（右）
      out.push(
        { kind: "rect", x: left - NOZ_W, y: feedY - NOZ_H / 2, w: NOZ_W, h: NOZ_H, style: { fill: theme.fillLight, stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "rect", x: right, y: refluxY - NOZ_H / 2, w: NOZ_W, h: NOZ_H, style: { fill: theme.fillLight, stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }

    // 塔身贴数：有「额外数据点」(watches) 则逐塔盘竖直平铺其读数（精馏塔多塔盘温度，告警变色），
    // 把「只在检视面板看」升级成「贴塔身显示」；否则回落单中部温度（原行为）。
    const readouts = state.watchReadouts ?? [];
    if (readouts.length > 0) {
      const n = readouts.length;
      const padY = 16; // 上下留边，避开封头
      const usable = H - padY * 2;
      readouts.forEach((r, i) => {
        const ry = top + padY + (n === 1 ? usable / 2 : (usable * i) / (n - 1));
        const color = r.level === "alarm" ? theme.alarm : r.level === "warn" ? theme.interlock : theme.text;
        // 浅底条盖住该处塔盘线 → 数值清晰；居中显示读数（仅值，标签留在检视面板，与现场 DCS 一致）
        out.push(
          { kind: "rect", x: left + 1, y: ry - 6, w: W - 2, h: 12, style: { fill: theme.fillLight } },
          { kind: "text", x: cx, y: ry + 3, text: formatReadout(r.value, r.unit), style: { fill: color, font: "600 9px ui-sans-serif, system-ui", textAlign: "center" } },
        );
      });
    } else {
      const temp = toFiniteNumber(state.values.temp, NaN);
      if (Number.isFinite(temp)) {
        out.push({ kind: "text", x: cx, y: cy + 4, text: `${Math.round(temp)}°`, style: { fill: theme.text, font: "600 12px ui-sans-serif, system-ui", textAlign: "center" } });
      }
    }

    out.push(...labelAndInline(node, state, theme, base + LABEL_GAP));
    return out;
  },
};
