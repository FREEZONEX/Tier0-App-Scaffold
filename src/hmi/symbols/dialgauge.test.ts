import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dialgauge } from "./dialgauge";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "PI-01", type: "dialgauge", x: 100, y: 100, rotation: 0, label: "PI-01", topics: [], bindings: {}, inline: [] };

function build(value: unknown, scale?: number) {
  return dialgauge.build({ node, state: { values: { value }, running: false, fault: false, stale: false }, theme, scale });
}

function needle(value: unknown) {
  // 指针始终为最后一条 line（刻度短线在前）
  const lines = build(value).filter((p) => p.kind === "line");
  return lines[lines.length - 1] as { x1: number; y1: number; x2: number; y2: number };
}

describe("dialgauge symbol", () => {
  it("含表盘圆 + 5 刻度 + 指针", () => {
    const prims = build(50);
    assert.ok(prims.some((p) => p.kind === "circle"));
    assert.equal(prims.filter((p) => p.kind === "line").length, 6); // 5 刻度 + 1 指针
  });
  it("指针从圆心出发，长度在半径内", () => {
    const n = needle(50);
    assert.equal(n.x1, 100);
    assert.equal(n.y1, 100);
    assert.ok(Math.hypot(n.x2 - 100, n.y2 - 100) <= 26);
  });
  it("不同 value 指针角度不同", () => {
    const a = needle(0);
    const b = needle(100);
    assert.notDeepEqual([a.x2, a.y2], [b.x2, b.y2]);
  });
  // 特征断言①：刻度弧为 path A 弧图元 + 底部表座为梯形（polygon 4 点）
  it("含刻度弧（path A 弧）与底部表座梯形（polygon）", () => {
    const prims = build(50);
    const arc = prims.find((p) => p.kind === "path");
    assert.ok(arc, "应有刻度弧 path 图元");
    assert.equal(arc!.kind === "path" && arc!.d[0].c, "A"); // 弧指令
    const base = prims.find((p) => p.kind === "polygon");
    assert.ok(base, "应有底部表座梯形");
    assert.equal(base!.kind === "polygon" && base!.points.length, 4); // 梯形 4 顶点
  });

});
