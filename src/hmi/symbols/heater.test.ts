import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heater } from "./heater";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");

const mk = (over = {}) => ({
  id: "X",
  type: "heater",
  x: 100,
  y: 100,
  rotation: 0,
  label: "X",
  topics: [],
  bindings: {},
  inline: [],
  ...over,
});

const build = (
  values = {},
  st: { node?: object; running?: boolean; fault?: boolean; stale?: boolean } = {},
  scale?: number,
) =>
  heater.build({
    node: mk(st.node) as never,
    state: { values, running: false, fault: false, stale: false, ...st },
    theme,
    scale,
  });

const firstRect = (prims: Primitive[]) => prims.find((p): p is Extract<Primitive, { kind: "rect" }> => p.kind === "rect");
const polyline = (prims: Primitive[]) => prims.find((p): p is Extract<Primitive, { kind: "polyline" }> => p.kind === "polyline");
const lines = (prims: Primitive[]) => prims.filter((p): p is Extract<Primitive, { kind: "line" }> => p.kind === "line");
// 横向进出管嘴：y1 === y2（与竖向法兰线、斜支腿区分）
const nozzleLines = (prims: Primitive[]) => lines(prims).filter((l) => l.y1 === l.y2);

describe("heater symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("含外壳矩形 + 锯齿盘管 polyline + 两段进出管嘴", () => {
    const prims = build();
    const rect = firstRect(prims);
    assert.ok(rect, "应有外壳矩形");
    assert.equal(rect?.w, 60);
    assert.equal(rect?.h, 40);
    const coil = polyline(prims);
    assert.ok(coil, "应有加热盘管 polyline");
    assert.ok(coil!.points.length >= 4, "盘管应为来回折线（多点）");
    assert.equal(nozzleLines(prims).length, 2, "左右各一段横向管嘴");
  });

  it("外壳为圆角矩形（圆角包住盘管）", () => {
    const rect = firstRect(build());
    assert.ok((rect?.r ?? 0) > 0, "外壳应为圆角矩形");
  });

  it("running → 外壳用 fillDeep（醒目），盘管用 fillLight", () => {
    const rect = firstRect(build({}, { running: true }));
    assert.equal(rect?.style.fill, theme.running);
    const coil = polyline(build({}, { running: true }));
    assert.equal(coil?.style.stroke, theme.fillLight);
  });

  it("静止态 → 外壳用 fillLight，盘管用 stroke", () => {
    const rect = firstRect(build({}, { running: false }));
    assert.equal(rect?.style.fill, theme.fillLight);
    const coil = polyline(build({}, { running: false }));
    assert.equal(coil?.style.stroke, theme.stroke);
  });

  it("本体描边一律 theme.stroke / strokeWidth 2", () => {
    const rect = firstRect(build());
    assert.equal(rect?.style.stroke, theme.stroke);
    assert.equal(rect?.style.strokeWidth, 2);
  });

  it("temp 内联值进入标签文本", () => {
    const prims = build({ temp: 85 }, { node: { inline: ["temp"] } });
    const texts = prims.filter((p): p is Extract<Primitive, { kind: "text" }> => p.kind === "text");
    assert.ok(texts.some((t) => t.text.includes("85")), "应渲染 temp 数值");
  });

  it("bounds 包含管嘴宽度且圆形命中关闭", () => {
    const b = heater.bounds(mk() as never);
    assert.ok(b.w > 60, "包围盒应含两侧管嘴");
    assert.notEqual(heater.circular, true);
  });

  it("细节层：≥2 支腿 + 进出口法兰短竖线（textMuted 低对比）", () => {
    const prims = build({}, {}, 1);
    // 竖向细线：法兰短竖线（x1 === x2）
    const flangeLines = lines(prims).filter((l) => l.x1 === l.x2 && l.style.stroke === theme.textMuted);
    assert.ok(flangeLines.length >= 2, "进出口各一条法兰短竖线");
    // 斜向支腿（x1 !== x2 且 y1 !== y2）
    const legLines = lines(prims).filter((l) => l.x1 !== l.x2 && l.y1 !== l.y2 && l.style.stroke === theme.textMuted);
    assert.ok(legLines.length >= 2, "底部至少 2 支腿");
    // 状态语义不被细节抢色：外壳/盘管仍走状态色，细节走 textMuted
    const rect = firstRect(prims);
    assert.equal(rect?.style.fill, theme.fillLight);
  });

});
