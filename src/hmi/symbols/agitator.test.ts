import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agitator } from "./agitator";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "X", type: "agitator", x: 100, y: 100, rotation: 0, label: "X", topics: ["t"], bindings: {}, inline: [] };

const build = (values = {}, st = {}, scale?: number) =>
  agitator.build({ node, state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

// 电机箱是最窄的 rect（上级·小），减速箱较宽（下级·大）。
const boxes = (running: boolean) =>
  build({}, { running }).filter((p) => p.kind === "rect") as { w: number; style: { fill?: string } }[];

describe("agitator symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("含电机箱+减速箱两级矩形（上小下大叠放）+ 竖直搅拌轴", () => {
    const prims = build();
    const rects = prims.filter((p) => p.kind === "rect") as { x: number; y: number; w: number; h: number }[];
    assert.equal(rects.length, 2, "应有两级矩形（电机箱+减速箱）");
    const [motor, gear] = [...rects].sort((a, b) => a.y - b.y); // 按 y 升序：上为电机箱、下为减速箱
    assert.ok(motor.w < gear.w, "上级电机箱应比下级减速箱窄（上小下大）");
    assert.ok(motor.y + motor.h <= gear.y + 0.5, "电机箱底应贴近减速箱顶（叠放）");
    const shaft = prims.find((p) => p.kind === "line" && p.x1 === node.x && p.x2 === node.x && p.y2 > p.y1);
    assert.ok(shaft, "应有一条同 x 的竖直轴线");
  });

  it("运行：驱动头两级矩形深填充·醒目", () => {
    const running = boxes(true);
    assert.ok(running.every((b) => b.style.fill === theme.running), "运行态两级矩形均深填充");
  });

  it("停止：驱动头两级矩形浅填充", () => {
    const stopped = boxes(false);
    assert.ok(stopped.every((b) => b.style.fill === theme.fillLight), "停止态两级矩形均浅填充");
  });

  it("含上层直叶（过轴心的水平横线）", () => {
    const prims = build();
    const horiz = prims.filter(
      (p) => p.kind === "line" && p.y1 === p.y2 && p.x1 < node.x && p.x2 > node.x,
    );
    assert.ok(horiz.length >= 1, "应有一条横跨轴心的上层直叶");
  });

  it("含下层对称斜桨叶（左右各一条从轴心发散的斜线）", () => {
    const diag = (build().filter(
      (p) => p.kind === "line" && p.x1 === node.x && p.x2 !== node.x,
    ) as { x2: number }[]);
    assert.ok(diag.some((p) => p.x2 < node.x), "应有指向左的下层斜叶");
    assert.ok(diag.some((p) => p.x2 > node.x), "应有指向右的下层斜叶");
  });

  it("bounds 上含驱动头、下含桨叶（覆盖锚点上下）", () => {
    const b = agitator.bounds(node);
    assert.ok(b.y < node.y, "顶边应在锚点之上（含驱动头）");
    assert.ok(b.y + b.h > node.y, "底边应在锚点之下（含桨叶）");
  });

  it("rpm 内联显示（node.inline 配置后）", () => {
    const inlineNode = { ...node, inline: ["rpm"] };
    const out = agitator.build({ node: inlineNode, state: { values: { rpm: 180 }, running: false, fault: false, stale: false }, theme });
    const txt = out.filter((p) => p.kind === "text") as { text: string }[];
    assert.ok(txt.some((t) => t.text.includes("180")));
  });
});
