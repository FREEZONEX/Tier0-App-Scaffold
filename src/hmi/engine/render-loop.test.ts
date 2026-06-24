import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRenderLoop } from "./render-loop";

/** 手动驱动的假 rAF。 */
function fakeRaf() {
  let cbs: ((t: number) => void)[] = [];
  const raf = (cb: (t: number) => void) => { cbs.push(cb); return cbs.length; };
  const flush = (t: number) => { const run = cbs; cbs = []; run.forEach((cb) => cb(t)); };
  return { raf, flush, pending: () => cbs.length };
}

describe("createRenderLoop", () => {
  it("脏时调用 render，干净且无动画时不调用", () => {
    const f = fakeRaf();
    let renders = 0;
    const loop = createRenderLoop({ render: () => { renders += 1; }, hasAnimation: () => false, raf: f.raf });
    loop.start();
    loop.markDirty();
    f.flush(16);
    assert.equal(renders, 1);
    f.flush(32); // 不脏、无动画
    assert.equal(renders, 1);
  });
  it("有动画时持续重绘", () => {
    const f = fakeRaf();
    let renders = 0;
    const loop = createRenderLoop({ render: () => { renders += 1; }, hasAnimation: () => true, raf: f.raf });
    loop.start();
    f.flush(16);
    f.flush(32);
    assert.equal(renders, 2);
  });
  it("render 收到自 start 起的经过毫秒（首帧归零）", () => {
    const f = fakeRaf();
    const times: number[] = [];
    const loop = createRenderLoop({ render: (t) => times.push(t), hasAnimation: () => true, raf: f.raf });
    loop.start();
    f.flush(1000); // 首帧设 startTime=1000，经过 0
    f.flush(1500); // 经过 500
    assert.equal(times[0], 0);
    assert.equal(times[1], 500);
  });
  it("stop 后不再重绘", () => {
    const f = fakeRaf();
    let renders = 0;
    const loop = createRenderLoop({ render: () => { renders += 1; }, hasAnimation: () => true, raf: f.raf });
    loop.start();
    loop.stop();
    f.flush(16);
    assert.equal(renders, 0);
  });
});
