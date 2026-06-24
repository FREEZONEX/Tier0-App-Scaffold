import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pump } from "./pump";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "P-01", type: "pump", x: 100, y: 100, rotation: 0, label: "P-01", topics: ["t"], bindings: {}, inline: [] };

const build = (running: boolean, scale?: number) =>
  pump.build({ node, state: { values: {}, running, fault: false, stale: false }, theme, scale });

// 蜗壳casing = 一体轮廓 path（圆弧 + 出料口）；状态填充挂在它上面。
function casing(running: boolean) {
  return build(running).find((p) => p.kind === "path") as { style: { fill?: string } };
}

describe("pump symbol", () => {
  it("运行=蜗壳绿填充", () => {
    assert.equal(casing(true).style.fill, theme.running);
  });
  it("停止=蜗壳浅填充", () => {
    assert.equal(casing(false).style.fill, theme.fillLight);
  });
  it("蜗壳为一体 path 轮廓（圆弧+出料口）+ 叶轮内圈 circle，不自转", () => {
    const prims = build(false);
    assert.ok(prims.some((p) => p.kind === "path"), "蜗壳一体轮廓 path");
    assert.ok(prims.some((p) => p.kind === "circle"), "叶轮内圈 circle");
    assert.ok(!prims.some((p) => p.kind === "rotate"), "OpenBridge 静态符号，不自转");
  });
  it("出料口轮廓含圆弧（A）指令——一体延伸而非另加方块", () => {
    const path = build(false).find((p) => p.kind === "path") as { d: readonly { c: string }[] };
    assert.ok(path.d.some((cmd) => cmd.c === "A"), "蜗壳轮廓含 A 圆弧");
  });
  it("circular: true（命中按蜗壳圆）", () => {
    assert.equal(pump.circular, true);
  });
});
