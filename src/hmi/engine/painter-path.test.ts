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
    rect: rec("rect"), roundRect: rec("roundRect"), clip: rec("clip"), fillText: rec("fillText"),
    save: rec("save"), restore: rec("restore"), translate: rec("translate"), rotate: rec("rotate"),
    setLineDash: rec("setLineDash"),
    set globalAlpha(_v: number) {}, set strokeStyle(_v: string) {}, set fillStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set font(_v: string) {}, set textAlign(_v: string) {},
    set lineDashOffset(_v: number) {},
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe("painter path 图元", () => {
  it("按指令序列绘制 M/L/Q/C/A 并 fill+stroke", () => {
    const ctx = mockCtx();
    const p: Primitive = {
      kind: "path",
      d: [
        { c: "M", x: 0, y: 0 },
        { c: "L", x: 10, y: 0 },
        { c: "Q", x1: 15, y1: 5, x: 10, y: 10 },
        { c: "C", x1: 5, y1: 12, x2: 2, y2: 12, x: 0, y: 10 },
        { c: "A", cx: 0, cy: 5, r: 5, a0: Math.PI / 2, a1: -Math.PI / 2 },
      ],
      close: true,
      style: { fill: "#eee", stroke: "#555", strokeWidth: 2 },
    };
    paint(ctx, [p], 0);
    const s = (ctx as unknown as { calls: string[] }).calls.join(";");
    assert.ok(s.includes("moveTo(0,0)"));
    assert.ok(s.includes("quadraticCurveTo(15,5,10,10)"));
    assert.ok(s.includes("bezierCurveTo(5,12,2,12,0,10)"));
    assert.ok(s.includes("arc("));
    assert.ok(s.includes("closePath"));
    assert.ok(s.includes("fill(") || s.includes("fill()"));
    assert.ok(s.includes("stroke"));
  });
});
