import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sparklinePath } from "./sparkline";
import { trendBounds, trendPath } from "./trend";
import { horizontalBars, barsHeight } from "./bars";
import { gaugeAngle, gaugeProgress, polar } from "./gauge";

describe("trend", () => {
  it("多序列共享 min/max", () => {
    assert.deepEqual(trendBounds([{ name: "a", values: [1, 5] }, { name: "b", values: [3, 9] }]), { min: 1, max: 9 });
  });
  it("常量序列 max=min+1，空序列 0..1", () => {
    assert.deepEqual(trendBounds([{ name: "a", values: [4, 4] }]), { min: 4, max: 5 });
    assert.deepEqual(trendBounds([]), { min: 0, max: 1 });
  });
  it("trendPath 在共享范围下映射，y 轴反转", () => {
    // min=0,max=10,height=100: 值 0→y100(底), 10→y0(顶)
    const p = trendPath([0, 10], 100, 100, 0, 10);
    assert.equal(p, "0,100 100,0");
  });
  it("空序列 → 空串", () => {
    assert.equal(trendPath([], 100, 100, 0, 1), "");
  });
  it("非有限值不污染范围/坐标（NaN/Infinity 守卫）", () => {
    // 单个 NaN 不应让整条线变 NaN：其余点坐标仍有限
    const p = sparklinePath([10, NaN, 30], 100, 100);
    assert.ok(!/NaN/.test(p), `sparkline 不应含 NaN: ${p}`);
    assert.deepEqual(trendBounds([{ name: "a", values: [5, Infinity, 9] }]), { min: 5, max: 9 });
    assert.ok(!/NaN/.test(trendPath([5, Infinity, 9], 100, 100, 5, 9)));
  });
});

describe("bars", () => {
  it("条宽按 value/max 占比，行按序堆叠", () => {
    const rects = horizontalBars([{ label: "A", value: 5 }, { label: "B", value: 10 }], 100, 16, 4, 10);
    assert.equal(rects[0].w, 50); // 5/10
    assert.equal(rects[1].w, 100); // 10/10
    assert.equal(rects[1].y, 20); // 16+4
  });
  it("缺 max 取最大值；负/非数钳为 0", () => {
    const rects = horizontalBars([{ label: "A", value: -3 }, { label: "B", value: 8 }], 80, 10, 2);
    assert.equal(rects[0].w, 0);
    assert.equal(rects[1].w, 80);
  });
  it("barsHeight 累加行高与间隙", () => {
    assert.equal(barsHeight(3, 16, 4), 16 * 3 + 4 * 2);
    assert.equal(barsHeight(0, 16, 4), 0);
  });
});

describe("gauge", () => {
  it("gaugeAngle 钳制 0..100 → 135..405", () => {
    assert.equal(gaugeAngle(0), 135);
    assert.equal(gaugeAngle(100), 405);
    assert.equal(gaugeAngle(50), 270);
    assert.equal(gaugeAngle(-20), 135);
    assert.equal(gaugeAngle(180), 405);
  });
  it("polar 计算极坐标点", () => {
    const [x, y] = polar(0, 0, 0, 10);
    assert.equal(x, 10);
    assert.equal(y, 0);
  });
  it("gaugeProgress 产出 SVG 弧 path", () => {
    assert.match(gaugeProgress(50, 50, 40, 50), /^M .* A 40 40 /);
  });
});
