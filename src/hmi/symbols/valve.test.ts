import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { valve } from "./valve";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "HV-01", type: "valve", x: 100, y: 100, rotation: 0, label: "HV-01", topics: ["t"], bindings: {}, inline: [] };

function build(open: unknown, scale?: number) {
  return valve.build({ node, state: { values: { open }, running: false, fault: false, stale: false }, theme, scale });
}

function polys(open: unknown, scale?: number) {
  return build(open, scale).filter((p) => p.kind === "polygon") as { style: { fill?: string } }[];
}

describe("valve symbol", () => {
  it("开启：深填充（通路·醒目，与泵运行一致）", () => {
    assert.equal(polys(true)[0].style.fill, theme.running);
  });
  it("关闭：浅填充（阻断·静止）", () => {
    assert.equal(polys(false)[0].style.fill, theme.fillLight);
  });
  it("产出两个三角（蝶形）", () => {
    assert.equal(polys(true).length, 2);
  });

  it("细节层：阀杆+手轮共 2 条 textMuted line（中心竖线 + 顶部横帽）", () => {
    const detailLines = build(true, 1).filter(
      (p) => p.kind === "line" && (p as { style: { stroke?: string } }).style.stroke === theme.textMuted,
    );
    assert.equal(detailLines.length, 2);
    // 阀杆为中心竖线：x1===x2===cx，且自蝶形顶向上
    const stem = detailLines.find(
      (p) => (p as { x1: number; x2: number }).x1 === node.x && (p as { x1: number; x2: number }).x2 === node.x,
    ) as { y1: number; y2: number } | undefined;
    assert.ok(stem, "应有一条中心竖直阀杆");
    assert.ok(stem!.y2 < stem!.y1, "阀杆自蝶形顶向上延伸");
    // 手轮为水平横帽：y1===y2，跨越中心两侧
    const wheel = detailLines.find(
      (p) => (p as { y1: number; y2: number }).y1 === (p as { y1: number; y2: number }).y2,
    ) as { x1: number; x2: number } | undefined;
    assert.ok(wheel, "应有一条顶部水平手轮横帽");
    assert.ok(wheel!.x1 < node.x && wheel!.x2 > node.x, "手轮跨越中心两侧");
  });

});
