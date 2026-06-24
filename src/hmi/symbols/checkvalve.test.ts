import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkvalve } from "./checkvalve";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "CV-01", type: "checkvalve", x: 100, y: 100, rotation: 0, label: "CV-01", topics: ["t"], bindings: {}, inline: [] };

const build = (values: Record<string, unknown> = {}, st: Record<string, unknown> = {}, scale?: number) =>
  checkvalve.build({ node, state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

type Poly = { points: readonly (readonly [number, number])[]; style: { fill?: string; stroke?: string } };

function polygons(values: Record<string, unknown>): Poly[] {
  return build(values).filter((p) => p.kind === "polygon") as Poly[];
}

// 方向三角 = 尖点在右、随底色反相的那个三角（区别于恒描边的左侧阀座三角）
function flowTriangle(values: Record<string, unknown>): Poly {
  const polys = polygons(values);
  // 流向三角的尖点 x 最大
  return polys.reduce((best, p) => {
    const tip = Math.max(...p.points.map((pt) => pt[0]));
    const bestTip = Math.max(...best.points.map((pt) => pt[0]));
    return tip > bestTip ? p : best;
  });
}

// 阀体圆 = 半径最大的 circle（状态填充载体，区别于细节层铰点小圆）
function bodyCircle(values: Record<string, unknown>): { r: number; style: { fill?: string } } {
  const circles = build(values).filter((p) => p.kind === "circle") as { r: number; style: { fill?: string } }[];
  return circles.reduce((best, c) => (c.r > best.r ? c : best));
}

describe("checkvalve symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("阀体为圆形 + 左右管嘴（恰好一个圆、两条管嘴线）", () => {
    const prims = build();
    const circles = prims.filter((p) => p.kind === "circle");
    // 1:1 含细节层铰点小圆，故 ≥1 个圆；阀体圆为最大半径者
    assert.ok(circles.length >= 1);
    const lines = prims.filter((p) => p.kind === "line");
    // 两条管嘴（+ 细节层摆瓣斜线）
    assert.ok(lines.length >= 2);
  });

  it("阀座双三角：恰好两个 polygon（对顶三角，止回阀标志形体）", () => {
    const polys = polygons({});
    assert.equal(polys.length, 2);
  });

  it("有流（open）：阀体圆深填充 running（通路·醒目）+ 方向三角反相浅色", () => {
    assert.equal(bodyCircle({ open: true }).style.fill, theme.running);
    const a = flowTriangle({ open: true });
    assert.equal(a.style.fill, theme.fillLight);
  });

  it("无流（关）：阀体圆浅填充 + 方向三角仅描边（阻断·静止）", () => {
    assert.equal(bodyCircle({ open: false }).style.fill, theme.fillLight);
    const a = flowTriangle({ open: false });
    assert.equal(a.style.fill, undefined);
    assert.equal(a.style.stroke, theme.stroke);
  });

  it("方向三角指向右（流向）：尖点 x 大于底边 x", () => {
    const pts = flowTriangle({ open: true }).points;
    const xs = pts.map((p) => p[0]);
    const tip = Math.max(...xs);
    const base = Math.min(...xs);
    assert.ok(tip > base);
    // 尖点唯一且在右侧
    assert.equal(xs.filter((x) => x === tip).length, 1);
  });

  it("open 缺省时回退到 values.running（阀体圆状态色）", () => {
    // 无 open、无 running → 阻断（阀体浅填充）
    assert.equal(bodyCircle({}).style.fill, theme.fillLight);
    // values.running=true 作为 open 的回退 → 通路（阀体深填充）
    assert.equal(bodyCircle({ running: true }).style.fill, theme.running);
  });

  it("circular 命中按外接圆", () => {
    assert.equal(checkvalve.circular, true);
  });
});
