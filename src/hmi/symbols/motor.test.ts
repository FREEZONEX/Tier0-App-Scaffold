import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { motor } from "./motor";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");
const node = { id: "M-01", type: "motor", x: 100, y: 100, rotation: 0, label: "M-01", topics: [], bindings: {}, inline: [] };

function build(running: boolean, scale?: number): Primitive[] {
  return motor.build({ node, state: { values: {}, running, fault: false, stale: false }, theme, scale });
}

// 机身 = 最宽的圆角矩形（接线盒更窄），状态色加在机身上
function bodyRect(running: boolean): { style: { fill?: string }; w: number } {
  const rects = build(running).filter((p): p is Extract<Primitive, { kind: "rect" }> => p.kind === "rect");
  return rects.reduce((widest, r) => (r.w > widest.w ? r : widest));
}

describe("motor symbol", () => {
  it("运行=深填充，停止=浅填充", () => {
    assert.equal(bodyRect(true).style.fill, theme.running);
    assert.equal(bodyRect(false).style.fill, theme.fillLight);
  });
  it("circular=true 圆形命中", () => {
    assert.equal(motor.circular, true);
  });
  it("机身为圆角矩形图元（带圆角 r）", () => {
    const body = bodyRect(false);
    assert.ok(body.w >= 40); // 机身是最宽矩形
    const rect = build(false).filter((p): p is Extract<Primitive, { kind: "rect" }> => p.kind === "rect").find((r) => r.w === body.w)!;
    assert.ok(typeof rect.r === "number" && rect.r > 0);
  });
  it("右侧轴伸：伸出机身右缘的粗线（x2 > 机身右缘）", () => {
    const prims = build(false);
    const bodyW = bodyRect(false).w;
    const bodyRight = node.x + bodyW / 2;
    const shaft = prims.find(
      (p): p is Extract<Primitive, { kind: "line" }> =>
        p.kind === "line" && p.y1 === node.y && p.y2 === node.y && p.x2 > bodyRight,
    );
    assert.ok(shaft, "应存在伸出机身的轴伸粗线");
    assert.equal(shaft!.style.strokeWidth, 3);
  });
  it("细节层：散热筋至少 4 道横细线 + 2 道端盖竖线", () => {
    const lines = build(false).filter((p): p is Extract<Primitive, { kind: "line" }> => p.kind === "line");
    // 横线（散热筋，y1===y2）排除轴伸（粗 3px）
    const fins = lines.filter((l) => l.y1 === l.y2 && l.style.strokeWidth !== 3);
    assert.ok(fins.length >= 4, `散热筋应≥4 道，实得 ${fins.length}`);
    // 端盖竖线（x1===x2）
    const caps = lines.filter((l) => l.x1 === l.x2);
    assert.ok(caps.length >= 2, `端盖竖线应≥2 道，实得 ${caps.length}`);
  });

});
