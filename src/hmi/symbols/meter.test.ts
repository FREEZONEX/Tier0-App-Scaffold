import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meter } from "./meter";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "FT-01", type: "meter", x: 100, y: 100, rotation: 0, label: "FT-01", topics: ["t"], bindings: {}, inline: ["flow"] };

type State = { values: Record<string, unknown>; units?: Record<string, string>; running: boolean; fault: boolean; stale: boolean };

function build(state: State, scale?: number) {
  return meter.build({ node, state, theme, scale });
}

describe("meter symbol", () => {
  it("圆形主体 + 双 chevron", () => {
    const prims = build({ values: { flow: 17.2 }, running: false, fault: false, stale: false });
    assert.ok(prims.some((p) => p.kind === "circle"));
    assert.equal(prims.filter((p) => p.kind === "polyline").length, 2);
  });
  it("内联显示流量值（单位取配置的 units，不内置推断）", () => {
    // 配了单位 → 值带单位
    const withUnit = build({ values: { flow: 17.2 }, units: { flow: "m³/h" }, running: false, fault: false, stale: false });
    assert.ok(withUnit.some((p) => p.kind === "text" && /17\.2 m³\/h/.test((p as { text: string }).text)));
    // 没配单位 → 只显示数值（不再硬加单位）
    const noUnit = build({ values: { flow: 17.2 }, running: false, fault: false, stale: false });
    assert.ok(noUnit.some((p) => p.kind === "text" && /17\.2/.test((p as { text: string }).text)));
    assert.ok(!noUnit.some((p) => p.kind === "text" && /m³\/h/.test((p as { text: string }).text)));
  });
  it("flow 值缺失显示占位 --", () => {
    const prims = build({ values: {}, running: false, fault: false, stale: false });
    assert.ok(prims.some((p) => p.kind === "text" && /--/.test((p as { text: string }).text)));
  });

  // 状态→填充语义（绝不改）：running→表体 fillDeep / 静止→fillLight
  it("running 时表体填 fillDeep，静止时填 fillLight", () => {
    const bodyFill = (state: State) => {
      const prims = build(state);
      const circle = prims.find((p) => p.kind === "circle") as { style: { fill?: string } };
      return circle.style.fill;
    };
    assert.equal(bodyFill({ values: { flow: 17.2 }, running: true, fault: false, stale: false }), theme.running);
    assert.equal(bodyFill({ values: { flow: 17.2 }, running: false, fault: false, stale: false }), theme.fillLight);
  });

  // 特征①：表面读数窗（圆内小矩形）+ 两侧法兰对（细节层左右各双竖短线 ≥4 line）
  it("表面读数窗为 rect 图元；细节层两侧法兰对 ≥4 条竖 line", () => {
    const prims = build({ values: { flow: 17.2 }, running: false, fault: false, stale: false }, 1);
    // 读数窗矩形（基础形体，圆内小矩形）
    assert.ok(prims.some((p) => p.kind === "rect"), "应有读数窗 rect");
    // 法兰对：竖直短 line（x1===x2），细节层 ≥4 条
    const verticalLines = prims.filter(
      (p) => p.kind === "line" && (p as { x1: number; x2: number }).x1 === (p as { x1: number; x2: number }).x2,
    );
    assert.ok(verticalLines.length >= 4, `法兰竖线应 ≥4，实际 ${verticalLines.length}`);
  });

});
