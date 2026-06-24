import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { terminal } from "./terminal";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "FEED", type: "terminal", x: 100, y: 100, rotation: 0, label: "FEED", topics: [], bindings: {}, inline: [] };

function build(scale?: number) {
  return terminal.build({ node, state: { values: {}, running: false, fault: false, stale: false }, theme, scale });
}

type Poly = { kind: "polygon"; points: readonly (readonly [number, number])[]; style: { fill?: string } };

describe("terminal symbol", () => {
  it("实心三角箭头，尖端指向料流方向（x 最大、y 居中、实色填充）", () => {
    const head = build().filter((p): p is Poly => p.kind === "polygon").find((p) => p.points.length === 3);
    assert.ok(head, "应有三角箭头");
    const apex = head!.points.reduce((a, b) => (b[0] > a[0] ? b : a));
    assert.equal(apex[1], node.y, "尖端 y 居中");
    assert.equal(head!.style.fill, theme.stroke, "实心填充强调流向");
  });

  it("有箭身（一条水平线，左端=连接点）", () => {
    const shaft = build().find((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number } | undefined;
    assert.ok(shaft, "应有箭身");
    assert.equal(shaft!.y1, node.y, "箭身水平");
    assert.equal(shaft!.y2, node.y);
    assert.ok(shaft!.x1 < shaft!.x2, "箭身从左向右");
  });

  it("默认内联字段为 flow（流量）", () => {
    assert.deepEqual(terminal.inlineFields, ["flow"]);
  });

  it("noFade：不随未配置/失联褪色虚化", () => {
    assert.equal(terminal.noFade, true);
  });
});
