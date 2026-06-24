// 审查：每个「布尔态」图元（running/open…）两态的视觉区别够不够明显。
// 原理：renderScene 出两态 primitives，比对每个 primitive（fill + 几何）是否变，
// 按填充面积加权算「变化占比」。占比低 = 两态长得像 = 设计缺陷（状态映射没落到显示）。
// 用法：node --import tsx scripts/audit-state-visual.mts
import { buildScene } from "../src/hmi/scene/scene";
import { renderScene } from "../src/hmi/symbols/scene-render";
import { createDefaultRegistry } from "../src/hmi/symbols/default-registry";
import { getPalette } from "../src/hmi/engine/theme";
import { ALL_CAPABILITIES } from "../src/hmi/symbols/capabilities";
import { makeState, PREVIEW_PROPS } from "../src/hmi/symbols/preview";
import type { Primitive } from "../src/hmi/engine/primitives";
import type { Mimic } from "../src/hmi/schema/schema";

const reg = createDefaultRegistry();
const theme = getPalette("light");

// 通用包围盒面积：从任意图元类型抓出所有数值坐标（含 rect/circle/line/path/polygon
// + 递归 group/clip/scale 的 children），算 bbox。覆盖填充块与几何变化（叶片转角等）。
function bbox(p: Primitive): { x0: number; y0: number; x1: number; y1: number } | null {
  const o = p as unknown as Record<string, unknown> & { d?: unknown[]; points?: unknown[]; children?: Primitive[] };
  const xs: number[] = [], ys: number[] = [];
  const px = (v: unknown) => { if (typeof v === "number") xs.push(v); };
  const py = (v: unknown) => { if (typeof v === "number") ys.push(v); };
  px(o.x); py(o.y); px(o.x1); py(o.y1); px(o.x2); py(o.y2); px(o.cx); py(o.cy);
  if (typeof o.x === "number" && typeof o.w === "number") px(o.x + o.w);
  if (typeof o.y === "number" && typeof o.h === "number") py(o.y + o.h);
  if (typeof o.cx === "number" && typeof o.r === "number") { px(o.cx - (o.r as number)); px(o.cx + (o.r as number)); }
  if (typeof o.cy === "number" && typeof o.r === "number") { py(o.cy - (o.r as number)); py(o.cy + (o.r as number)); }
  for (const seg of (Array.isArray(o.d) ? o.d : []) as Record<string, unknown>[]) { px(seg.x); py(seg.y); px(seg.x1); py(seg.y1); }
  for (const pt of (Array.isArray(o.points) ? o.points : []) as (Record<string, unknown> | number[])[]) {
    if (Array.isArray(pt)) { px(pt[0]); py(pt[1]); } else { px(pt.x); py(pt.y); }
  }
  for (const c of o.children ?? []) { const b = bbox(c); if (b) { xs.push(b.x0, b.x1); ys.push(b.y0, b.y1); } }
  if (!xs.length || !ys.length) return null;
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
// 粗筛权重 = bbox 面积。注意：这是面积法，会**低估**「细线染色 / 局部指示器」（如搅拌器叶轮转绿、
// 旋转弧）——它们感知上醒目但面积小。低分 ≠ 一定有问题，是「需人工/像素复核」的信号，别当判决。
function weight(p: Primitive): number {
  const b = bbox(p);
  return b ? (b.x1 - b.x0) * (b.y1 - b.y0) : 0;
}

function render(type: string, on: boolean, boolKey: string, props?: Record<string, unknown>): Primitive[] {
  const node = { id: "s", type, x: 0, y: 0, rotation: 0, label: "", topics: [], bindings: {}, inline: [], ...(props ? { props } : {}) };
  const scene = buildScene({ meta: { name: "s", version: 1 }, nodes: [node], edges: [], interlocks: [] } as Mimic);
  const cap = ALL_CAPABILITIES.find((c) => c.type === type)!;
  const state = makeState(cap, { [boolKey]: on });
  return renderScene(scene, reg, () => state, () => false, theme).primitives;
}

const rows: { type: string; key: string; pct: number; note: string }[] = [];
for (const cap of ALL_CAPABILITIES) {
  const boolKey = cap.states.find((s) => s.kind === "boolean")?.key;
  if (!boolKey) continue; // 只审布尔态（数值态靠连续填充/指针，天然可分）
  const props = PREVIEW_PROPS[cap.type];
  const A = render(cap.type, false, boolKey, props);
  const B = render(cap.type, true, boolKey, props);
  let changed = 0, total = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const ar = A[i] ? weight(A[i]) : 0, br = B[i] ? weight(B[i]) : 0;
    const slot = Math.max(ar, br);
    total += slot;
    if (JSON.stringify(A[i] ?? null) !== JSON.stringify(B[i] ?? null)) changed += slot;
  }
  const pct = total ? (changed / total) * 100 : 0;
  const note = pct < 8 ? "🔍 面积变化极小·像素复核" : pct < 20 ? "· 偏弱" : "✓ 明显";
  rows.push({ type: cap.type, key: boolKey, pct, note });
}

rows.sort((a, b) => a.pct - b.pct);
console.log("布尔态图元 · 两态 bbox 面积变化占比（粗筛，越低越要复核；面积法低估局部指示器如搅拌器）\n");
for (const r of rows) {
  console.log(`${r.type.padEnd(13)} ${r.key.padEnd(8)} ${r.pct.toFixed(0).padStart(3)}%  ${r.note}`);
}
