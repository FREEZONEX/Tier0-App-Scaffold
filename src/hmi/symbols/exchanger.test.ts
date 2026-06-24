import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exchanger } from "./exchanger";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "HX-01", type: "exchanger", x: 100, y: 100, rotation: 0, label: "HX-01", topics: [], bindings: {}, inline: [] };

function build(scale?: number) {
  return exchanger.build({ node, state: { values: {}, running: false, fault: false, stale: false }, theme, scale });
}

describe("exchanger symbol", () => {
  it("壳体矩形（圆角）为基础形体，任意缩放都画", () => {
    const prims = build(0.5);
    const shell = prims.find((p) => p.kind === "rect") as { r?: number } | undefined;
    assert.ok(shell, "应有壳体矩形");
  });

  it("两端管箱为 path 椭圆弧封头（≥2 条 path）", () => {
    const prims = build();
    const heads = prims.filter((p) => p.kind === "path");
    assert.ok(heads.length >= 2, "左右两端各一道封头 path");
  });

  it("管板竖线 + 上下 4 管嘴：≥6 条 line（基础形体）", () => {
    const prims = build(0.5); // 缩小（细节层折流板隐藏）下仍应有管板+管嘴
    const lines = prims.filter((p) => p.kind === "line");
    assert.ok(lines.length >= 6, `管板 2 + 管嘴 4，实际 ${lines.length}`);
  });

  it("壳体填充用 fillLight，不抢异常色", () => {
    const prims = build();
    const shell = prims.find((p) => p.kind === "rect") as { style: { fill?: string } } | undefined;
    assert.equal(shell?.style.fill, theme.fillLight);
  });

});
