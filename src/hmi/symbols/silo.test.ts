import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { silo } from "./silo";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");
const mk = (over = {}) => ({ id: "SL-01", type: "silo", x: 100, y: 100, rotation: 0, label: "SL-01", topics: [], bindings: {}, inline: [], ...over });
const build = (
  values: Record<string, unknown> = {},
  st: { node?: object; running?: boolean; fault?: boolean; stale?: boolean } = {},
  scale?: number,
) => silo.build({ node: mk(st.node), state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

// 料位矩形裹在 clip 内
function liquidRect(prims: Primitive[]): { h: number } | undefined {
  const clip = prims.find((p) => p.kind === "clip") as { children: { kind: string; h: number; style: { fill?: string } }[] } | undefined;
  return clip?.children.find((c) => c.kind === "rect" && c.style.fill === theme.liquid);
}

describe("silo symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("含倒三角 60° 锥斗 polygon（料仓辨识特征，区别于储罐）", () => {
    const polys = build().filter((p) => p.kind === "polygon");
    assert.equal(polys.length, 1);
    // 锥斗为倒三角：尖端在底部，y 大于上沿两点
    const pts = (polys[0] as { points: readonly (readonly [number, number])[] }).points;
    const ys = pts.map((p) => p[1]);
    const tipY = Math.max(...ys);
    assert.equal(ys.filter((y) => y === tipY).length, 1, "倒三角仅一个最低尖端");
    // 上沿两点位于尖端正上方，且为锥斗口（仓体底）等高
    const upper = pts.filter((p) => p[1] < tipY);
    assert.equal(upper.length, 2, "锥斗口两点");
    assert.equal(upper[0][1], upper[1][1], "锥斗口两点等高");
  });

  it("含锥斗底部卸料短管 line（基础形体，任何缩放都画）", () => {
    // 缩小到隐藏细节层时，卸料短管仍在
    const lines = build({}, {}, 0.5).filter((p) => p.kind === "line");
    assert.ok(lines.length >= 1, "卸料短管为基础形体");
  });

  it("料位 0：无实料填充（无 clip）", () => {
    assert.equal(liquidRect(build({ level: 0 })), undefined);
  });

  it("level 驱动料位高度，料位用 liquid 裁到圆柱仓体圆角内", () => {
    const prims = build({ level: 50 });
    const clip = prims.find((p) => p.kind === "clip") as { r?: number } | undefined;
    assert.ok(clip && clip.r === 3, "料位应被圆角 clip 裹住");
    const fill = liquidRect(prims)!;
    assert.ok(fill.h > 30 && fill.h < 42, "72*0.5≈36"); // BODY_H=72
  });

  it("料位越满高度越高", () => {
    const low = liquidRect(build({ level: 20 }))!.h;
    const high = liquidRect(build({ level: 90 }))!.h;
    assert.ok(high > low);
  });

  it("料位即使缩小（隐藏细节层）仍绘制（状态层不受 LOD 影响）", () => {
    assert.ok(liquidRect(build({ level: 60 }, {}, 0.4)));
  });

  it("内联显示百分比文本", () => {
    assert.ok(build({ level: 73 }).some((p) => p.kind === "text" && /73/.test((p as { text: string }).text)));
  });

  it("bounds 居中于节点且覆盖锥斗与管嘴", () => {
    const b = silo.bounds(mk());
    assert.equal(b.x + b.w / 2, 100, "横向居中于锚点");
    assert.ok(b.h > 72, "包围盒应高于仓体本身（含锥斗与管嘴）");
  });
});
