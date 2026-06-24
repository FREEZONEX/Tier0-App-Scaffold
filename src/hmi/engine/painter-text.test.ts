import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paint } from "./painter";
import type { Primitive } from "./primitives";

function mockCtx() {
  const calls: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => { calls.push(`${name}(${args.map((a) => (typeof a === "number" ? Math.round(a * 100) / 100 : a)).join(",")})`); };
  return {
    calls,
    beginPath: rec("beginPath"), moveTo: rec("moveTo"), lineTo: rec("lineTo"),
    bezierCurveTo: rec("bezierCurveTo"), quadraticCurveTo: rec("quadraticCurveTo"),
    arc: rec("arc"), closePath: rec("closePath"), fill: rec("fill"), stroke: rec("stroke"),
    rect: rec("rect"), roundRect: rec("roundRect"), clip: rec("clip"),
    fillText: rec("fillText"), strokeText: rec("strokeText"),
    save: rec("save"), restore: rec("restore"), translate: rec("translate"), rotate: rec("rotate"),
    setLineDash: rec("setLineDash"),
    set globalAlpha(_v: number) {}, set strokeStyle(_v: string) {}, set fillStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set lineJoin(_v: string) {},
    set font(_v: string) {}, set textAlign(_v: string) {},
    set lineDashOffset(_v: number) {},
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe("painter text 图元", () => {
  it("无 halo：只 fillText 不 strokeText", () => {
    const ctx = mockCtx();
    const p: Primitive = { kind: "text", x: 5, y: 9, text: "P-01", style: { fill: "#333" } };
    paint(ctx, [p], 0);
    const s = ctx.calls.join(";");
    assert.ok(s.includes("fillText(P-01,5,9)"));
    assert.ok(!s.includes("strokeText"));
  });

  it("有 halo：先底色 strokeText 再 fillText（衬底反白防管线穿字）", () => {
    const ctx = mockCtx();
    const p: Primitive = { kind: "text", x: 5, y: 9, text: "P-01", style: { fill: "#333", halo: "#d4d7da" } };
    paint(ctx, [p], 0);
    const s = ctx.calls.join(";");
    const strokeIdx = ctx.calls.findIndex((c) => c.startsWith("strokeText(P-01"));
    const fillIdx = ctx.calls.findIndex((c) => c.startsWith("fillText(P-01"));
    assert.ok(strokeIdx >= 0, `应有 strokeText：${s}`);
    assert.ok(fillIdx > strokeIdx, "halo 描边必须先于填充");
  });
});
