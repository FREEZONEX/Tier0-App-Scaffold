import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createViewport, toWorld, toScreen, zoomAt, fit, clampScale, panBy, MIN_ZOOM, MAX_ZOOM } from "./viewport";

describe("viewport", () => {
  it("默认 1:1，屏幕=世界", () => {
    const vp = createViewport();
    assert.deepEqual(toScreen(vp, 10, 20), { x: 10, y: 20 });
  });
  it("平移后 toScreen 加偏移", () => {
    const vp = { scale: 1, x: 5, y: 7 };
    assert.deepEqual(toScreen(vp, 10, 20), { x: 15, y: 27 });
  });
  it("toWorld 是 toScreen 的逆", () => {
    const vp = { scale: 2, x: 5, y: 7 };
    const s = toScreen(vp, 10, 20);
    assert.deepEqual(toWorld(vp, s.x, s.y), { x: 10, y: 20 });
  });
  it("zoomAt 保持锚点屏幕位置不变", () => {
    const vp = { scale: 1, x: 0, y: 0 };
    const z = zoomAt(vp, 100, 100, 2);
    assert.equal(z.scale, 2);
    // 锚点 (100,100) 屏幕坐标在缩放前后一致
    const before = toScreen(vp, ...Object.values(toWorld(vp, 100, 100)) as [number, number]);
    const after = toScreen(z, ...Object.values(toWorld(vp, 100, 100)) as [number, number]);
    assert.deepEqual(before, after);
  });
});

describe("fit", () => {
  it("box 宽或高非正 → 返回默认视口", () => {
    assert.deepEqual(fit({ x: 0, y: 0, w: 0, h: 10 }, { w: 100, h: 100 }), createViewport());
  });
  it("无 padding：缩放使内容铺满并居中", () => {
    const vp = fit({ x: 0, y: 0, w: 100, h: 100 }, { w: 300, h: 300 }, 0);
    assert.equal(vp.scale, 3);
    const a = toScreen(vp, 0, 0);
    const b = toScreen(vp, 100, 100);
    assert.equal(a.x, 300 - b.x); // 左右边距相等（居中）
    assert.equal(a.y, 300 - b.y);
  });
  it("padding 缩小可用区域", () => {
    const vp = fit({ x: 0, y: 0, w: 100, h: 100 }, { w: 300, h: 300 }, 50);
    assert.equal(vp.scale, 2); // (300 - 50*2) / 100
  });
  it("非零原点的盒子也能正确居中", () => {
    const vp = fit({ x: 50, y: 50, w: 100, h: 100 }, { w: 300, h: 300 }, 0);
    const a = toScreen(vp, 50, 50);
    const b = toScreen(vp, 150, 150);
    assert.equal(a.x, 300 - b.x);
  });
  it("maxScale 限制放大：小图不被放大到超过设计尺寸", () => {
    const vp = fit({ x: 0, y: 0, w: 100, h: 100 }, { w: 300, h: 300 }, 0, 1);
    assert.equal(vp.scale, 1); // 本可放大到 3，被 maxScale=1 限制
  });
  it("maxScale 不影响需缩小的大图", () => {
    const vp = fit({ x: 0, y: 0, w: 600, h: 600 }, { w: 300, h: 300 }, 0, 1);
    assert.equal(vp.scale, 0.5);
  });
  it("容器小于 2×padding 时不产生负/0 scale（夹到正下界）", () => {
    const vp = fit({ x: 0, y: 0, w: 100, h: 100 }, { w: 10, h: 10 }, 24);
    assert.ok(vp.scale > 0, "scale 必须为正");
  });
});

describe("clampScale / panBy", () => {
  it("clampScale 夹到 [MIN_ZOOM, MAX_ZOOM]", () => {
    assert.equal(clampScale(0.0001), MIN_ZOOM);
    assert.equal(clampScale(999), MAX_ZOOM);
    assert.equal(clampScale(1.5), 1.5);
  });
  it("panBy 平移 x/y，scale 不变，不可变", () => {
    const vp = { scale: 2, x: 5, y: 7 };
    const moved = panBy(vp, 10, -3);
    assert.deepEqual(moved, { scale: 2, x: 15, y: 4 });
    assert.deepEqual(vp, { scale: 2, x: 5, y: 7 }); // 原对象不变
  });
  it("zoomAt + clampScale 保持锚点不动", () => {
    const vp = createViewport();
    const z = zoomAt(vp, 200, 150, clampScale(3));
    // 锚点世界坐标缩放前后映射回同一屏幕点
    const w = toWorld(vp, 200, 150);
    assert.deepEqual(toScreen(z, w.x, w.y), { x: 200, y: 150 });
  });
});
