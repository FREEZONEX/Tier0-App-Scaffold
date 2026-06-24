import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDecoration } from "./decoration";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const center = { cx: 100, cy: 100, r: 22 };

describe("buildDecoration", () => {
  it("ring=none 不产出环", () => {
    const prims = buildDecoration({ ring: "none", badge: "none", blink: false, faded: false, dashed: false }, center, theme);
    assert.equal(prims.length, 0);
  });
  it("给 box（非圆形/缩放节点）：环画成贴合 bounds 的圆角矩形而非大圆", () => {
    const anchor = { cx: 100, cy: 400, r: 300, box: { x: 80, y: 100, w: 40, h: 600 } };
    const prims = buildDecoration({ ring: "fault", badge: "none", blink: false, faded: false, dashed: false }, anchor, theme);
    const ring = prims.find((p) => p.kind === "rect") as { x: number; y: number; w: number; h: number; r?: number } | undefined;
    assert.ok(ring, "应为矩形环");
    assert.ok(!prims.some((p) => p.kind === "circle"), "不应是大圆环");
    assert.equal(ring!.w, 40 + 5 * 2); // 贴合 box + pad
    assert.equal(ring!.h, 600 + 5 * 2);
  });
  it("ring=fault 产出红环（circle 描边 alarm 色）", () => {
    const prims = buildDecoration({ ring: "fault", badge: "none", blink: true, faded: false, dashed: false }, center, theme);
    const ring = prims.find((p) => p.kind === "circle");
    assert.ok(ring);
    assert.equal((ring as { style: { stroke?: string } }).style.stroke, theme.alarm);
  });
  it("badge=fault 产出 ! 角标且 blink", () => {
    const prims = buildDecoration({ ring: "fault", badge: "fault", blink: true, faded: false, dashed: false }, center, theme);
    const bang = prims.find((p) => p.kind === "text" && p.text === "!");
    assert.ok(bang);
  });
  it("badge=interlock 画小锁（rect 锁体 + polyline 锁梁），不用字母", () => {
    const prims = buildDecoration({ ring: "none", badge: "interlock", blink: false, faded: false, dashed: false }, center, theme);
    assert.ok(prims.some((p) => p.kind === "rect")); // 锁体
    assert.ok(prims.some((p) => p.kind === "polyline")); // 锁梁
    assert.ok(!prims.some((p) => p.kind === "text")); // 不再用字母 L
  });
});
