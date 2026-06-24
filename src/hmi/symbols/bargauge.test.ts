import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bargauge } from "./bargauge";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "BG-01", type: "bargauge", x: 100, y: 100, rotation: 0, label: "BG-01", topics: [], bindings: {}, inline: [] };

function build(value: unknown, scale?: number) {
  return bargauge.build({ node, state: { values: { value }, running: false, fault: false, stale: false }, theme, scale });
}

function fillRect(value: unknown, scale?: number) {
  const prims = build(value, scale);
  const clip = prims.find((p) => p.kind === "clip") as { children: { kind: string; h: number; y: number; style: { fill?: string } }[] } | undefined;
  return clip?.children.find((c) => c.kind === "rect" && c.style.fill === theme.liquid) as { h: number; y: number } | undefined;
}

describe("bargauge symbol", () => {
  it("value 0：无填充", () => {
    assert.equal(fillRect(0), undefined);
  });
  it("value 100：填满（高≈64）", () => {
    assert.ok((fillRect(100)?.h ?? 0) > 60);
  });
  it("value 50：约半高", () => {
    const h = fillRect(50)?.h ?? 0;
    assert.ok(h > 28 && h < 36);
  });
  it("越界值被夹紧", () => {
    assert.ok((fillRect(999)?.h ?? 0) <= 64);
  });
  it("液位条填的是 theme.liquid 色", () => {
    const rect = fillRect(50);
    assert.ok(rect, "应有液位条");
  });

  // 特征断言①：细节层右侧刻度短线为 line 图元，共 4 道
  it("细节层有 4 道右侧刻度短线（line 图元）", () => {
    const lines = build(50, 1).filter((p) => p.kind === "line");
    assert.equal(lines.length, 4);
  });

});
