import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { damper } from "./damper";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "DM-01", type: "damper", x: 100, y: 100, rotation: 0, label: "DM-01", topics: [], bindings: {}, inline: [] };

function build(open: unknown, scale?: number) {
  return damper.build({ node, state: { values: { open }, running: false, fault: false, stale: false }, theme, scale });
}

function firstBlade(open: unknown) {
  return build(open).find((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number };
}

describe("damper symbol", () => {
  it("开=水平叶片（y1==y2）", () => {
    const b = firstBlade(true);
    assert.equal(b.y1, b.y2);
  });
  it("关=斜置叶片（y1!=y2）", () => {
    const b = firstBlade(false);
    assert.notEqual(b.y1, b.y2);
  });
  it("含风道矩形", () => {
    const prims = build(undefined);
    assert.ok(prims.some((p) => p.kind === "rect"));
  });

  // —— 状态→填充：开（激活）叶片用 running，关（静止）用 stroke，绝不混入异常色 ——
  it("开态叶片描边=running（激活态）", () => {
    const lines = build(true).filter((p) => p.kind === "line") as { style: { stroke?: string } }[];
    const blades = lines.filter((l) => l.style.stroke === theme.running);
    assert.ok(blades.length >= 3, "应有≥3条 running 叶片");
  });
  it("关态叶片描边=stroke（静止态）", () => {
    const lines = build(false).filter((p) => p.kind === "line") as { style: { stroke?: string } }[];
    const blades = lines.filter((l) => l.style.stroke === theme.stroke);
    assert.ok(blades.length >= 3, "应有≥3条 stroke 叶片");
  });

  // —— 特征断言①：百叶为多条 line 图元；执行机构小盒为额外 rect（风道 rect 之外） ——
  it("百叶为多条斜线（≥3 条叶片 line）", () => {
    const lines = build(false).filter((p) => p.kind === "line");
    assert.ok(lines.length >= 3, "百叶应至少 3 条叶片 line");
  });
  it("含外挂执行机构小盒（风道矩形之外的额外 rect）", () => {
    const rects = build(true).filter((p) => p.kind === "rect");
    // 风道矩形 + 执行机构小盒 ≥ 2 个 rect
    assert.ok(rects.length >= 2, "应有风道矩形 + 执行机构小盒至少 2 个 rect");
  });

});
