import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cooler } from "./cooler";
import { isSpinning } from "./spin";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");
const node = { id: "CT-01", type: "cooler", x: 100, y: 100, rotation: 0, label: "CT-01", topics: [], bindings: {}, inline: [] };

function build(running: boolean, scale?: number): Primitive[] {
  return cooler.build({ node, state: { values: {}, running, fault: false, stale: false }, theme, scale });
}

describe("cooler symbol", () => {
  it("管束 rect + 顶置风机圆 + 管束水平细线", () => {
    const prims = build(false);
    assert.ok(prims.filter((p) => p.kind === "rect").length >= 1, "翅片管束矩形");
    assert.ok(prims.filter((p) => p.kind === "circle").length >= 1, "顶置风机圆");
    // 风机圆位于管束顶之上（圆心 y < 节点 y）
    const fan = prims.find((p) => p.kind === "circle") as Extract<Primitive, { kind: "circle" }>;
    assert.ok(fan.cy < node.y, "风机圆在顶部");
  });

  it("运行=风机圆绿 running，静止=白底 fillLight", () => {
    const fanOn = build(true).find((p) => p.kind === "circle") as { style: { fill?: string } };
    const fanOff = build(false).find((p) => p.kind === "circle") as { style: { fill?: string } };
    assert.equal(fanOn.style.fill, theme.running);
    assert.equal(fanOff.style.fill, theme.fillLight);
  });

  it("特征：风机叶片放射短线 + 两侧支架腿（细节层 line ≥ 风机叶片数 + 管束横线 + 支腿）", () => {
    const lines = build(false, 1).filter((p) => p.kind === "line");
    // 6 风机叶片 + 3 管束横线 + 1 接管 + 2 支腿 = 12 条
    assert.ok(lines.length >= 12, `细节层应含放射叶片/管束横线/支腿，实得 ${lines.length}`);
  });

  it("运行=风叶整组绕风机圆心自转（spinPeriod rotate），静止不自转", () => {
    const spin = build(true, 1).find((p) => p.kind === "rotate") as
      | { spinPeriod?: number; cy: number; children: { kind: string }[] }
      | undefined;
    assert.ok(spin && spin.spinPeriod, "运行应有 spinPeriod rotate");
    assert.ok(spin!.cy < node.y, "自转中心=风机圆心（管束之上）");
    assert.ok(spin!.children.every((c) => c.kind === "line"), "rotate 内裹风叶短线");
    assert.ok(!build(false, 1).some((p) => p.kind === "rotate"), "静止不自转");
  });

  it("isSpinning(cooler) 仅在运行时为真（驱动 rAF 维持）", () => {
    assert.equal(isSpinning("cooler", true), true);
    assert.equal(isSpinning("cooler", false), false);
  });
});
