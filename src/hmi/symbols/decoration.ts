import type { Primitive, Style } from "../engine/primitives";
import type { Palette } from "../engine/theme";
import type { Decoration, Badge } from "./state-language";

export interface AnchorCircle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** 非圆形节点的缩放后 bounds：给定则环画成贴合的圆角矩形（而非按 r 的大圆）。
   *  瘦高/放大的图元（如缩放后的塔）按 r 画圆会糊成超大圈，矩形环才贴身。 */
  readonly box?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

const BADGE_TEXT: Record<"fault" | "stale", string> = {
  fault: "!",
  stale: "?",
};

function badgeColor(badge: Badge, theme: Palette): string {
  switch (badge) {
    case "fault": return theme.alarm;
    case "interlock": return theme.interlock;
    case "stale": return theme.stale;
    default: return theme.stale;
  }
}

/** 角标内容图元：联锁画小锁（锁体 + 锁梁），其余画字母。 */
function badgeContent(badge: Exclude<Badge, "none">, bx: number, by: number, blink: boolean, theme: Palette, kind?: Decoration["interlockKind"]): Primitive[] {
  const fg = theme.badgeFg;
  if (badge === "interlock") {
    // 锁变体：trip=红芯锁体（高危）、inhibit=空心锁（禁启未强制）、其余=实心近白锁
    const bodyFill = kind === "trip" ? theme.alarm : kind === "inhibit" ? undefined : fg;
    const bodyStroke = kind === "inhibit" ? fg : undefined;
    return [
      { kind: "rect", x: bx - 3.5, y: by - 0.5, w: 7, h: 5, r: 1, style: { fill: bodyFill, stroke: bodyStroke, strokeWidth: bodyStroke ? 1 : undefined } },
      { kind: "polyline", points: [[bx - 2.2, by - 0.5], [bx - 2.2, by - 2.6], [bx - 1.3, by - 3.6], [bx + 1.3, by - 3.6], [bx + 2.2, by - 2.6], [bx + 2.2, by - 0.5]], style: { stroke: fg, strokeWidth: 1.3, lineCap: "round" } },
    ];
  }
  return [
    { kind: "text", x: bx, y: by + 4, text: BADGE_TEXT[badge], style: { fill: fg, font: "700 11px ui-sans-serif, system-ui", textAlign: "center", blink } },
  ];
}

/** 把装饰编码画成图元：选中/故障环 + 右上角标。anchor 为图元主体外接圆。 */
/** 环图元：非圆形（给了 box）画贴合 bounds 的圆角矩形，圆形/缺省按 r 画圆。 */
function ringPrim(anchor: AnchorCircle, pad: number, style: Style): Primitive {
  if (anchor.box) {
    const b = anchor.box;
    return { kind: "rect", x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2, r: 6, style };
  }
  return { kind: "circle", cx: anchor.cx, cy: anchor.cy, r: anchor.r + pad, style };
}

export function buildDecoration(deco: Decoration, anchor: AnchorCircle, theme: Palette): Primitive[] {
  const out: Primitive[] = [];
  if (deco.ring === "selection") {
    out.push(ringPrim(anchor, 9, { stroke: theme.selection, strokeWidth: 2 }));
  } else if (deco.ring === "fault") {
    out.push(ringPrim(anchor, 5, { stroke: theme.alarm, strokeWidth: 3, blink: deco.blink }));
  } else if (deco.ring === "warn") {
    // 高/低报：琥珀环、稳定不闪（比故障弱一级，防视觉疲劳）
    out.push(ringPrim(anchor, 5, { stroke: theme.interlock, strokeWidth: 2.5 }));
  }
  if (deco.badge !== "none") {
    // 角标落右上角：非圆形取 box 右上，圆形取 r 偏移位。
    const bx = anchor.box ? anchor.box.x + anchor.box.w : anchor.cx + anchor.r * 0.8;
    const by = anchor.box ? anchor.box.y : anchor.cy - anchor.r * 0.8;
    const color = badgeColor(deco.badge, theme);
    const blink = deco.badge === "fault" && deco.blink;
    out.push({ kind: "circle", cx: bx, cy: by, r: 8, style: { fill: color, blink } });
    out.push(...badgeContent(deco.badge, bx, by, blink, theme, deco.interlockKind));
  }
  return out;
}
