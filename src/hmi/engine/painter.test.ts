import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paint } from "./painter";
import type { Primitive } from "./primitives";

/** 伪 ctx：记录所有调用与属性赋值。 */
function fakeCtx() {
  const calls: string[] = [];
  const set: Record<string, unknown> = {};
  const handler = {
    get(_t: unknown, prop: string) {
      if (["fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "font", "textAlign", "lineCap", "lineDashOffset"].includes(prop)) {
        return set[prop];
      }
      return (...args: unknown[]) => { calls.push(`${prop}(${args.join(",")})`); };
    },
    set(_t: unknown, prop: string, value: unknown) { set[prop] = value; calls.push(`${prop}=${value}`); return true; },
  };
  const ctx = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, set };
}

describe("paint", () => {
  it("画 circle：设置 fill/stroke 并调用 arc+fill+stroke", () => {
    const prims: Primitive[] = [
      { kind: "circle", cx: 10, cy: 20, r: 5, style: { fill: "#fff", stroke: "#000", strokeWidth: 2 } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0);
    assert.ok(calls.includes("fillStyle=#fff"));
    assert.ok(calls.includes("strokeStyle=#000"));
    assert.ok(calls.includes("lineWidth=2"));
    assert.ok(calls.some((c) => c.startsWith("arc(10,20,5")));
    assert.ok(calls.includes("fill()"));
    assert.ok(calls.includes("stroke()"));
  });

  it("画 text：设置 font/textAlign 并 fillText", () => {
    const prims: Primitive[] = [
      { kind: "text", x: 1, y: 2, text: "62%", style: { fill: "#000", font: "16px sans", textAlign: "center" } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0);
    assert.ok(calls.includes("font=16px sans"));
    assert.ok(calls.includes("textAlign=center"));
    assert.ok(calls.some((c) => c.startsWith("fillText(62%,1,2")));
  });

  it("blink 在半周期(550ms)时降低 globalAlpha", () => {
    const prims: Primitive[] = [
      { kind: "circle", cx: 0, cy: 0, r: 1, style: { fill: "#f00", blink: true } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 550); // BLINK_PERIOD=1100 的一半 → 最暗
    assert.ok(calls.some((c) => c.startsWith("globalAlpha=") && !c.endsWith("=1")));
  });

  it("blink 在周期起点(0ms)时全亮", () => {
    const prims: Primitive[] = [
      { kind: "circle", cx: 0, cy: 0, r: 1, style: { fill: "#f00", blink: true } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0);
    assert.ok(calls.includes("globalAlpha=1"));
  });

  it("flow line 设置 lineDashOffset 随时间变化", () => {
    const prims: Primitive[] = [
      { kind: "line", x1: 0, y1: 0, x2: 10, y2: 0, style: { stroke: "#000", strokeWidth: 3 }, flow: true },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 500); // 流向周期 1000 的一半 → offset = -9
    assert.ok(calls.includes("lineDashOffset=-9"));
  });

  it("clip：save→roundRect→clip→画子图元→restore", () => {
    const prims: Primitive[] = [
      { kind: "clip", x: 0, y: 0, w: 20, h: 20, r: 4, children: [
        { kind: "rect", x: 0, y: 10, w: 20, h: 10, style: { fill: "#abc" } },
      ] },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0);
    assert.ok(calls.includes("save()"));
    assert.ok(calls.some((c) => c.startsWith("roundRect(0,0,20,20,4")));
    assert.ok(calls.includes("clip()"));
    assert.ok(calls.includes("fillStyle=#abc")); // 子图元被绘制
    assert.ok(calls.includes("restore()"));
    // restore 在子图元绘制之后
    assert.ok(calls.lastIndexOf("restore()") > calls.indexOf("fillStyle=#abc"));
  });

  it("rotate 静态：按固定 deg 旋转，不随 timeMs 变", () => {
    const prims: Primitive[] = [
      { kind: "rotate", cx: 0, cy: 0, deg: 180, children: [{ kind: "circle", cx: 1, cy: 0, r: 1, style: { fill: "#000" } }] },
    ];
    const a = fakeCtx(); paint(a.ctx, prims, 0);
    const b = fakeCtx(); paint(b.ctx, prims, 999);
    assert.ok(a.calls.includes(`rotate(${Math.PI})`), "deg=180 → π");
    assert.ok(b.calls.includes(`rotate(${Math.PI})`), "无 spinPeriod：任何 timeMs 角度不变");
  });

  it("rotate 自转：spinPeriod 时角度随 timeMs 推进", () => {
    const prims: Primitive[] = [
      { kind: "rotate", cx: 0, cy: 0, deg: 0, spinPeriod: 1000, children: [{ kind: "circle", cx: 1, cy: 0, r: 1, style: { fill: "#000" } }] },
    ];
    const at0 = fakeCtx(); paint(at0.ctx, prims, 0);
    const at500 = fakeCtx(); paint(at500.ctx, prims, 500); // 半圈 → 180°(π)
    assert.ok(at0.calls.includes("rotate(0)"), "t=0 → 0°");
    assert.ok(at500.calls.includes(`rotate(${Math.PI})`), "t=500/1000 → 180°");
  });

  it("wave：填充闭合路径（顶边采样 lineTo + 底边收口），相位随 timeMs 变", () => {
    const prims: Primitive[] = [
      { kind: "wave", x: 0, y: 10, w: 12, h: 20, amp: 2, wavelength: 12, period: 2000, style: { fill: "#09f" } },
    ];
    const a = fakeCtx(); paint(a.ctx, prims, 0);
    assert.ok(a.calls.includes("fillStyle=#09f") && a.calls.includes("fill()"), "应填充");
    assert.ok(a.calls.includes("closePath()"), "闭合路径");
    assert.ok(a.calls.some((c) => c.startsWith("lineTo(")), "顶边采样描点");
    // 相位推进（t=0 vs 1/4 周期）→ 液面坐标序列不同（动起来）
    const b = fakeCtx(); paint(b.ctx, prims, 500);
    const lt = (calls: string[]) => calls.filter((c) => c.startsWith("lineTo(")).join("|");
    assert.notEqual(lt(a.calls), lt(b.calls), "相位推进→液面坐标变化");
  });

  it("wave：period=0 静态（相位冻结，任何 timeMs 坐标一致）", () => {
    const prims: Primitive[] = [
      { kind: "wave", x: 0, y: 10, w: 12, h: 20, amp: 2, wavelength: 12, period: 0, style: { fill: "#09f" } },
    ];
    const lt = (t: number) => { const c = fakeCtx(); paint(c.ctx, prims, t); return c.calls.filter((x) => x.startsWith("lineTo(")).join("|"); };
    assert.equal(lt(0), lt(9999), "period=0 → 不随时间变");
  });
});
