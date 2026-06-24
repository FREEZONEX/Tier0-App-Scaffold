import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safetyvalve } from "./safetyvalve";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");

const mk = (over = {}) => ({
  id: "PSV-1",
  type: "safetyvalve",
  x: 100,
  y: 100,
  rotation: 0,
  label: "PSV-1",
  topics: [],
  bindings: {},
  inline: [],
  ...over,
});

const build = (
  values: Record<string, unknown> = {},
  st: Record<string, unknown> = {},
  scale?: number,
): Primitive[] =>
  safetyvalve.build({
    node: mk((st as { node?: object }).node),
    state: { values, running: false, fault: false, stale: false, ...st },
    theme,
    scale,
  });

const rects = (ps: Primitive[]) => ps.filter((p): p is Extract<Primitive, { kind: "rect" }> => p.kind === "rect");

describe("safetyvalve symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("阀体为方块 rect，比例更挺拔（高>宽）", () => {
    const r = rects(build());
    assert.equal(r.length, 1);
    assert.equal(r[0].w, 22);
    assert.equal(r[0].h, 26);
    assert.ok(r[0].h > r[0].w, "阀体应高>宽，立式更挺拔");
  });

  it("open=true 阀体用 running（泄压通路醒目），关时 fillLight", () => {
    const openBody = rects(build({ open: true }))[0];
    const closedBody = rects(build({ open: false }))[0];
    assert.equal(openBody.style.fill, theme.running);
    assert.equal(closedBody.style.fill, theme.fillLight);
  });

  it("接受真值字符串 open（如 'open'/'1'）", () => {
    assert.equal(rects(build({ open: "open" }))[0].style.fill, theme.running);
    assert.equal(rects(build({ open: "1" }))[0].style.fill, theme.running);
  });

  it("有朝上的出口管嘴（垂直 line，从阀体顶边向上）", () => {
    const lines = build().filter((p): p is Extract<Primitive, { kind: "line" }> => p.kind === "line");
    // 出口：x1==x2==cx 且 y2 < y1（向上），起点在阀体顶边 (cy-HH=87)
    const outlet = lines.find((l) => l.x1 === 100 && l.x2 === 100 && l.y2 < l.y1 && l.y1 === 87);
    assert.ok(outlet, "应存在朝上的出口管嘴");
  });

  it("有侧面水平进口管嘴", () => {
    const lines = build().filter((p): p is Extract<Primitive, { kind: "line" }> => p.kind === "line");
    const inlet = lines.find((l) => l.y1 === 100 && l.y2 === 100 && l.x1 < l.x2 && l.x2 === 89);
    assert.ok(inlet, "应存在左侧水平进口管嘴");
  });

  it("有顶部弹簧符号（zigzag polyline，多折点）", () => {
    const polylines = build().filter((p): p is Extract<Primitive, { kind: "polyline" }> => p.kind === "polyline");
    const zigzag = polylines.find((p) => p.points.length >= 5);
    assert.ok(zigzag, "应存在弹簧 zigzag polyline");
    // zigzag 左右交替偏移 cx
    const xs = zigzag!.points.map((pt) => pt[0]);
    assert.ok(xs.some((x) => x < 100) && xs.some((x) => x > 100), "弹簧应左右摆动");
  });

  it("细节层：从阀顶斜伸的杠杆配重柄（斜线 line + 杆端配重 circle）", () => {
    const ps = build();
    const lines = ps.filter((p): p is Extract<Primitive, { kind: "line" }> => p.kind === "line");
    // 斜线：x1!=x2 且 y1!=y2（既非纯水平的进口也非纯垂直的出口/箭头杆），向右上斜伸
    const lever = lines.find((l) => l.x1 !== l.x2 && l.y1 !== l.y2 && l.x2 > l.x1 && l.y2 < l.y1);
    assert.ok(lever, "应存在从阀顶斜伸的杠杆配重柄斜线");
    assert.equal(lever!.style.stroke, theme.textMuted, "细节层用低对比 textMuted");
    // 杆端配重小块（circle）
    const circles = ps.filter((p): p is Extract<Primitive, { kind: "circle" }> => p.kind === "circle");
    assert.ok(circles.length >= 1, "应存在杆端配重 circle");
  });

  it("本体描边使用 theme.stroke 且 strokeWidth=2", () => {
    const body = rects(build())[0];
    assert.equal(body.style.stroke, theme.stroke);
    assert.equal(body.style.strokeWidth, 2);
  });

  it("末尾包含位号标签 text", () => {
    const labels = build().filter((p): p is Extract<Primitive, { kind: "text" }> => p.kind === "text");
    assert.ok(labels.some((t) => t.text === "PSV-1"));
  });

  it("bounds 向上扩展覆盖出口+弹簧+箭头（顶边高于阀体顶），右侧覆盖杠杆柄", () => {
    const b = safetyvalve.bounds(mk());
    assert.ok(b.y < 100 - 13, "包围盒上边界应高于阀体顶边");
    assert.ok(b.h > 0 && b.w > 0);
    // 右边界应越过阀体右侧（容纳斜伸的杠杆配重柄）
    assert.ok(b.x + b.w > 100 + 11 + 18, "包围盒右边界应覆盖杠杆配重柄");
  });
});
