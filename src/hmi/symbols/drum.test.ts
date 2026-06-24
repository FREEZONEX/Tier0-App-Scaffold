import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { drum } from "./drum";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const mk = (over = {}) => ({ id: "D-01", type: "drum", x: 100, y: 100, rotation: 0, label: "D-01", topics: [], bindings: {}, inline: [], ...over });
const build = (values: Record<string, unknown> = {}, st: { node?: object; scale?: number } & Record<string, unknown> = {}) =>
  drum.build({ node: mk(st.node), state: { values, running: false, fault: false, stale: false, ...st }, theme, scale: st.scale });

// 液面现裹在 clip 内：活数据=wave（动画液面）、stale=rect（静态）
function liquidRect(prims: ReturnType<typeof build>): { h: number } | undefined {
  const clip = prims.find((p) => p.kind === "clip") as { children: { kind: string; h: number; style: { fill?: string } }[] } | undefined;
  return clip?.children.find((c) => (c.kind === "rect" || c.kind === "wave") && c.style.fill === theme.liquid);
}

describe("drum symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("壳体为 fillLight + stroke 描边的卧式胶囊 path 轮廓（含左右半圆封头 A 弧）", () => {
    const body = build().find((p) => p.kind === "path" && p.style.fill === theme.fillLight) as
      | { d: { c: string }[]; close?: boolean; style: { fill?: string; stroke?: string; strokeWidth?: number } }
      | undefined;
    assert.ok(body, "应有 fillLight 填充的壳体 path");
    assert.equal(body!.style.fill, theme.fillLight);
    assert.equal(body!.style.stroke, theme.stroke);
    assert.equal(body!.style.strokeWidth, 2, "外轮廓 strokeWidth 2");
    assert.ok(body!.close, "胶囊轮廓应闭合");
    const arcs = body!.d.filter((cmd) => cmd.c === "A");
    assert.equal(arcs.length, 2, "左右两端半圆封头各一条 A 弧");
  });

  it("液位 0：无液体（无 clip）", () => {
    assert.equal(build({ level: 0 }).find((p) => p.kind === "clip"), undefined);
  });

  it("液位 50：液体约半高，且被胶囊圆角 clip（r=22）裹住", () => {
    const prims = build({ level: 50 });
    const clip = prims.find((p) => p.kind === "clip") as { r?: number } | undefined;
    assert.ok(clip && clip.r === 22, "液位应被胶囊圆角 clip 裹住");
    const liquid = liquidRect(prims)!;
    assert.ok(liquid.h > 18 && liquid.h < 26); // 44*0.5 = 22
  });

  it("液位越界被钳到 0..100（150→满罐）", () => {
    const liquid = liquidRect(build({ level: 150 }))!;
    assert.equal(liquid.h, 44);
  });

  it("活数据→液面 wave 动画；失联(stale)→静态 rect 冻结", () => {
    const kinds = (st: Record<string, unknown>) => {
      const clip = build({ level: 50 }, st).find((p) => p.kind === "clip") as { children: readonly { kind: string }[] };
      return clip.children.map((c) => c.kind);
    };
    assert.ok(kinds({}).includes("wave"), "活数据液面应为 wave（动画）");
    assert.ok(kinds({ stale: true }).includes("rect") && !kinds({ stale: true }).includes("wave"), "失联液面应为静态 rect");
  });

  it("有左右两个水平进出管嘴", () => {
    const lines = build().filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    const horizontal = lines.filter((l) => l.y1 === l.y2 && l.x1 !== l.x2);
    assert.equal(horizontal.length, 2, "左右进出管嘴");
  });

  it("顶部无接管方块（造型精简，去顶部气相接管）", () => {
    const topRect = build().find((p) => p.kind === "rect" && p.style.fill === theme.fillLight && (p as { y: number }).y < 100 - 44 / 2);
    assert.equal(topRect, undefined, "不应再有顶部接管 rect");
  });

  it("细节层：底部 2 鞍座（textMuted path）", () => {
    const saddles = build({}, { scale: 1 }).filter(
      (p) => p.kind === "path" && p.style.stroke === theme.textMuted,
    );
    assert.equal(saddles.length, 2, "罐底两侧各一鞍座");
  });

  it("内联显示百分比文本", () => {
    assert.ok(build({ level: 73 }).some((p) => p.kind === "text" && /73/.test((p as { text: string }).text)));
  });

  it("bounds 居中于节点（水平方向）且锚点视觉居中", () => {
    const b = drum.bounds(mk());
    assert.equal(b.x, 100 - 48);
    assert.equal(b.w, 96);
    // 高度含顶部接管 + 底部鞍座
    assert.ok(b.h > 44, "命中框含接管与鞍座");
  });
});
