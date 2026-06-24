import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fan } from "./fan";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "F-01", type: "fan", x: 100, y: 100, rotation: 0, label: "F-01", topics: [], bindings: {}, inline: [] };
const build = (running: boolean) => fan.build({ node, state: { values: {}, running, fault: false, stale: false }, theme });

// running 时桨叶裹在自转 rotate 组内，静止时直接铺放。
function blades(running: boolean) {
  const prims = build(running);
  const spin = prims.find((p) => p.kind === "rotate") as { children: { kind: string }[] } | undefined;
  return spin ? spin.children.filter((p) => p.kind === "path") : prims.filter((p) => p.kind === "path");
}
function ring(running: boolean) {
  const circles = build(running).filter((p) => p.kind === "circle") as { r: number; style: { fill?: string } }[];
  return circles.reduce((a, b) => (b.r > a.r ? b : a));
}

describe("fan symbol", () => {
  it("轴流风机：外圈机壳 + 中心毂（2 圆）+ 3 桨叶 path", () => {
    const prims = build(false);
    assert.ok(prims.filter((p) => p.kind === "circle").length >= 2, "外圈机壳 + 中心毂");
    assert.equal(blades(false).length, 3, "3 片桨叶");
  });

  it("运行=外圈整圈绿 + 桨叶整组自转（spinPeriod rotate）", () => {
    const prims = build(true);
    assert.ok(prims.some((p) => p.kind === "rotate" && (p as { spinPeriod?: number }).spinPeriod), "running 桨叶应自转");
    assert.equal(ring(true).style.fill, theme.running, "运行外圈绿");
  });

  it("静止=外圈浅、不自转", () => {
    assert.ok(!build(false).some((p) => p.kind === "rotate"), "静止不自转");
    assert.equal(ring(false).style.fill, theme.fillLight, "静止外圈浅");
  });
});
