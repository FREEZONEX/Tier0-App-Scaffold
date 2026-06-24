import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compressor } from "./compressor";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "C-01", type: "compressor", x: 100, y: 100, rotation: 0, label: "C-01", topics: ["t"], bindings: {}, inline: [] };

function build(running: boolean, scale?: number) {
  return compressor.build({ node, state: { values: {}, running, fault: false, stale: false }, theme, scale });
}

function shell(running: boolean) {
  // 机壳为最大半径的外接圆（细节层中心轴端小圆半径远小于 R）。
  return build(running)
    .filter((p) => p.kind === "circle")
    .reduce((a, b) => ((a as { r: number }).r >= (b as { r: number }).r ? a : b)) as { style: { fill?: string } };
}

function wedge(running: boolean) {
  return build(running).find((p) => p.kind === "polygon") as { points: readonly (readonly [number, number])[]; style: { fill?: string; stroke?: string } };
}

describe("compressor symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build(false).length > 0);
  });
  it("运行：机壳深填充", () => {
    assert.equal(shell(true).style.fill, theme.running);
  });
  it("停止：机壳浅填充", () => {
    assert.equal(shell(false).style.fill, theme.fillLight);
  });
  it("运行：楔形实心（fillLight）", () => {
    const w = wedge(true);
    assert.equal(w.style.fill, theme.fillLight);
    assert.equal(w.style.stroke, undefined);
  });
  it("停止：楔形描边（stroke）", () => {
    const w = wedge(false);
    assert.equal(w.style.stroke, theme.stroke);
    assert.equal(w.style.fill, undefined);
  });
  it("楔形左宽右窄（左侧跨度 > 右侧跨度）", () => {
    const pts = wedge(false).points;
    const leftYs = pts.filter((p) => p[0] < node.x).map((p) => p[1]);
    const rightYs = pts.filter((p) => p[0] > node.x).map((p) => p[1]);
    const leftSpan = Math.max(...leftYs) - Math.min(...leftYs);
    const rightSpan = Math.max(...rightYs) - Math.min(...rightYs);
    assert.ok(leftSpan > rightSpan);
  });
  // 管嘴：窄矩形（w<12）；与底座垫块（宽矩形）区分。
  function nozzleRects() {
    return build(false).filter((p) => p.kind === "rect" && (p as { w: number }).w < 12) as { x: number; y: number; w: number; h: number }[];
  }
  it("含进出口两个矩形管嘴，且上下错位（出口在上、入口在下）", () => {
    const nozzles = nozzleRects();
    assert.equal(nozzles.length, 2);
    const centers = nozzles.map((n) => n.y + n.h / 2);
    const top = Math.min(...centers);
    const bottom = Math.max(...centers);
    // 上下错位：两管嘴纵向中心不重合（错位量明显）
    assert.ok(bottom - top >= 12);
    // 出口（高，y 小）在锚点上方，入口（低，y 大）在锚点下方
    assert.ok(top < node.y && bottom > node.y);
  });
  it("两管嘴左右分列（进口偏左、出口偏右）", () => {
    const nozzles = nozzleRects();
    const xs = nozzles.map((n) => n.x);
    // 一个在锚点左侧、一个在锚点右侧
    assert.ok(Math.min(...xs) < node.x && Math.max(...xs) > node.x);
  });
  it("bounds 为圆形外接方（含余量）", () => {
    const b = compressor.bounds(node);
    assert.equal(b.w, b.h);
    assert.ok(b.w >= 48);
  });
});
