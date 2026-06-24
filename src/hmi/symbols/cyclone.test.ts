import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cyclone } from "./cyclone";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");
const mk = (over = {}) => ({ id: "CY-01", type: "cyclone", x: 100, y: 100, rotation: 0, label: "CY-01", topics: [], bindings: {}, inline: [], ...over });
const build = (
  values: Record<string, unknown> = {},
  st: { node?: object; running?: boolean; fault?: boolean; stale?: boolean } = {},
  scale?: number,
) => cyclone.build({ node: mk(st.node), state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

// 料位矩形裹在 clip 内
function liquidRect(prims: Primitive[]): { h: number } | undefined {
  const clip = prims.find((p) => p.kind === "clip") as { children: { kind: string; h: number; style: { fill?: string } }[] } | undefined;
  return clip?.children.find((c) => c.kind === "rect" && c.style.fill === theme.liquid);
}

describe("cyclone symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("含细长倒锥体 polygon（锥长 ≈ 2×柱高 = 旋风分离器辨识特征）", () => {
    const polys = build().filter((p) => p.kind === "polygon");
    assert.equal(polys.length, 1);
    const pts = (polys[0] as { points: readonly (readonly [number, number])[] }).points;
    const ys = pts.map((p) => p[1]);
    // 锥体高度应明显大于圆柱段宽（“细长”特征），确保是长锥而非短斗
    const coneSpan = Math.max(...ys) - Math.min(...ys);
    assert.ok(coneSpan > 40, "锥体应细长（高度 > 40）");
  });

  it("含顶部升气管(vortex finder) rect——中心向上伸出本体顶（辨识特征）", () => {
    const rects = build().filter((p) => p.kind === "rect") as { x: number; y: number; w: number; h: number }[];
    const cylTop = 100 - CYL_H / 2;
    const finder = rects.find((r) => r.x < 100 && r.x + r.w > 100 && r.y < cylTop && r.w <= 10);
    assert.ok(finder, "应有中心向上伸出圆柱段顶的升气管 rect");
  });

  it("含切向入口矩形 rect——贴左上并横向伸出本体左缘（辨识特征）", () => {
    const rects = build().filter((p) => p.kind === "rect") as { x: number; y: number; w: number; h: number }[];
    const inlet = rects.find((r) => r.x < 100 - W_HALF && r.y < 100);
    assert.ok(inlet, "应有横向伸出本体左侧的切向入口矩形");
  });

  it("含锥底卸料管嘴 line（竖向伸出锥尖）", () => {
    const lines = build().filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    const discharge = lines.find((l) => l.x1 === l.x2 && l.x1 === 100 && l.y2 > l.y1);
    assert.ok(discharge, "应有锥底竖向卸料管嘴");
  });

  it("料位 0：无介质填充（无 clip）", () => {
    assert.equal(liquidRect(build({ level: 0 })), undefined);
  });

  it("level 驱动料位，介质用 theme.liquid 裁到圆柱段圆角内", () => {
    const prims = build({ level: 50 });
    const clip = prims.find((p) => p.kind === "clip") as { r?: number } | undefined;
    assert.ok(clip && clip.r === 2, "料位应被圆角 clip 裹住");
    assert.ok(liquidRect(prims), "应有 liquid 色料位矩形");
  });

  it("料位越满高度越高", () => {
    const low = liquidRect(build({ level: 20 }))!.h;
    const high = liquidRect(build({ level: 90 }))!.h;
    assert.ok(high > low);
  });

  it("料位与缩放无关（状态层任何缩放都画）", () => {
    assert.ok(liquidRect(build({ level: 50 }, {}, 0.5)), "缩小后料位仍应绘制");
  });

  it("bounds 覆盖切向入口与锥底管嘴（命中不偏移）", () => {
    const b = cyclone.bounds(mk());
    // 左缘需含切向入口矩形外延（< 本体左缘）
    assert.ok(b.x < 100 - W_HALF, "包围盒左缘应含切向入口矩形");
    // 总高需覆盖升气管 + 圆柱 + 长锥 + 卸料管嘴
    assert.ok(b.h > 80, "包围盒应覆盖升气管/圆柱/长锥/卸料管嘴");
  });
});

const W_HALF = 16; // 与 cyclone.ts 内 W/2 一致，用于测试本体边界判定
const CYL_H = 24; // 与 cyclone.ts 内 CYL_H 一致，用于判定升气管位于圆柱段顶之上
