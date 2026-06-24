import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mixer } from "./mixer";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "MX-01", type: "mixer", x: 100, y: 100, rotation: 0, label: "MX-01", topics: ["t"], bindings: {}, inline: [] };

const build = (values: Record<string, unknown> = {}, st: Record<string, unknown> = {}, scale?: number) =>
  mixer.build({ node, state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

describe("mixer symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("水平管壳：恰好一个矩形（fillLight + stroke）", () => {
    const rects = build().filter((p) => p.kind === "rect") as {
      w: number;
      h: number;
      style: { fill?: string; stroke?: string };
    }[];
    assert.equal(rects.length, 1);
    assert.ok(rects[0].w > rects[0].h, "管壳应横向（宽 > 高）");
    assert.equal(rects[0].style.fill, theme.fillLight);
    assert.equal(rects[0].style.stroke, theme.stroke);
  });

  it("内部交叉 X 混合元件 + 左右管嘴：足够多斜线坐实辨识特征", () => {
    const lines = build().filter((p) => p.kind === "line");
    // 2 条管嘴 + 每段 2 条斜线（≥4 段）= 至少 10 条线
    assert.ok(lines.length >= 10, `应有大量斜线/管嘴线，实得 ${lines.length}`);
  });

  it("混合元件成对斜向交叉（含 \\ 与 / 两种方向）", () => {
    const lines = build().filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    const diagonals = lines.filter((l) => l.x1 !== l.x2 && l.y1 !== l.y2);
    const down = diagonals.filter((l) => (l.x2 - l.x1) * (l.y2 - l.y1) > 0); // "\"
    const up = diagonals.filter((l) => (l.x2 - l.x1) * (l.y2 - l.y1) < 0); // "/"
    assert.ok(down.length >= 2, "应有向下对角线 \\");
    assert.ok(up.length >= 2, "应有向上对角线 /");
    assert.equal(down.length, up.length, "X 交叉应成对");
  });

  it("两端法兰对竖线：细节层左右各一对短竖线（textMuted）", () => {
    const lines = build().filter((p) => p.kind === "line") as {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      style: { stroke?: string };
    }[];
    // 竖直线：x 相等、y 不等
    const verticals = lines.filter((l) => l.x1 === l.x2 && l.y1 !== l.y2);
    assert.ok(verticals.length >= 4, `应有左右各一对（≥4 条）法兰竖线，实得 ${verticals.length}`);
    // 法兰竖线低对比 textMuted
    assert.ok(
      verticals.every((l) => l.style.stroke === theme.textMuted),
      "法兰竖线应使用低对比 textMuted",
    );
    // 左右各分布：以锚点 x 为界两侧均有
    assert.ok(verticals.some((l) => l.x1 < node.x), "应有左端法兰竖线");
    assert.ok(verticals.some((l) => l.x1 > node.x), "应有右端法兰竖线");
  });

  it("纯结构无状态：running 切换不改变图元数量/样式", () => {
    const off = JSON.stringify(build({}, { running: false }));
    const on = JSON.stringify(build({}, { running: true }));
    assert.equal(off, on);
  });

  it("无默认 inlineFields（纯结构件）", () => {
    assert.equal(mixer.inlineFields, undefined);
  });

  it("bounds 覆盖管嘴外延（含左右短管）", () => {
    const b = mixer.bounds(node);
    assert.ok(b.x < node.x - 56 / 2, "左界应延伸到管嘴外");
    assert.ok(b.x + b.w > node.x + 56 / 2, "右界应延伸到管嘴外");
  });
});
