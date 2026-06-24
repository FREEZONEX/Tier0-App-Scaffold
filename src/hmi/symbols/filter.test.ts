import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filter } from "./filter";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");
const node = { id: "FL-01", type: "filter", x: 100, y: 100, rotation: 0, label: "FL-01", topics: [], bindings: {}, inline: [] };

const baseState = { values: {}, running: false, fault: false, stale: false };

function build(scale?: number): Primitive[] {
  return filter.build({ node, state: baseState, theme, scale });
}

type Line = { kind: "line"; x1: number; y1: number; x2: number; y2: number; style: { stroke?: string; strokeWidth?: number } };

const lines = (prims: Primitive[]): Line[] => prims.filter((p): p is Line => p.kind === "line");

describe("filter symbol", () => {
  it("立式壳体矩形 + 细线", () => {
    const prims = build();
    const rect = prims.find((p) => p.kind === "rect") as { w: number; h: number } | undefined;
    assert.ok(rect, "应有壳体矩形");
    // 立式：高 > 宽
    assert.ok(rect!.h > rect!.w, "壳体应为立式（高大于宽）");
    assert.ok(lines(prims).length >= 2);
  });

  it("上进下出管嘴：两条沿中心轴的 stroke 竖管嘴（壳体外）", () => {
    const prims = build();
    const cx = 100;
    const nozzles = lines(prims).filter((l) => l.style.stroke === theme.stroke);
    assert.equal(nozzles.length, 2, "应有上进、下出两条管嘴");
    for (const n of nozzles) {
      assert.equal(n.x1, cx);
      assert.equal(n.x2, cx); // 竖直、沿中心轴
    }
    // 一条在壳顶上方（上进），一条在壳底下方（下出）
    const top = 100 - 44 / 2;
    const bottom = 100 + 44 / 2;
    assert.ok(nozzles.some((n) => Math.min(n.y1, n.y2) < top), "应有上进管嘴伸出壳顶");
    assert.ok(nozzles.some((n) => Math.max(n.y1, n.y2) > bottom), "应有下出管嘴伸出壳底");
  });

  it("细节层：内部滤芯竖纹 3 道（textMuted）裁在壳体内", () => {
    const prims = build();
    const muted = lines(prims).filter((l) => l.style.stroke === theme.textMuted);
    // 竖纹：x1 == x2（竖直），且 y1 != y2
    const verticals = muted.filter((l) => l.x1 === l.x2 && l.y1 !== l.y2);
    assert.equal(verticals.length, 3, "应有 3 道竖纹滤芯");
    for (const v of verticals) {
      assert.ok(v.x1 >= 100 - 15 && v.x1 <= 100 + 15, "竖纹应在壳体内");
      for (const y of [v.y1, v.y2]) assert.ok(y >= 100 - 22 && y <= 100 + 22, "竖纹纵向应在壳体内");
    }
  });

  it("细节层：快开顶盖一道横细线（textMuted）", () => {
    const prims = build();
    const muted = lines(prims).filter((l) => l.style.stroke === theme.textMuted);
    // 横线：y1 == y2（水平）
    const horizontals = muted.filter((l) => l.y1 === l.y2 && l.x1 !== l.x2);
    assert.equal(horizontals.length, 1, "应有 1 道快开顶盖横线");
    const cap = horizontals[0];
    const top = 100 - 44 / 2;
    assert.ok(cap.y1 > top && cap.y1 < top + 12, "盖线应贴近壳顶");
  });

});
