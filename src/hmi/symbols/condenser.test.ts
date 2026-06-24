import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { condenser } from "./condenser";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";

const theme = getPalette("light");
const node = { id: "HX-201", type: "condenser", x: 100, y: 100, rotation: 0, label: "HX-201", topics: [], bindings: {}, inline: [] };

function build(running: boolean, scale?: number): Primitive[] {
  return condenser.build({ node, state: { values: {}, running, fault: false, stale: false }, theme, scale });
}

describe("condenser symbol", () => {
  it("立式筒体（高>宽）", () => {
    const prims = build(false);
    const shell = prims.find((p) => p.kind === "rect" && p.w === 34) as { w: number; h: number } | undefined;
    assert.ok(shell && shell.h > shell.w, "筒体应为竖向（高>宽）");
  });

  it("状态→填充：静止 fillLight / running fillDeep（筒体不抢异常色）", () => {
    const idle = build(false).find((p) => p.kind === "rect" && p.w === 34) as { style: { fill: string } };
    const run = build(true).find((p) => p.kind === "rect" && p.w === 34) as { style: { fill: string } };
    assert.equal(idle.style.fill, theme.fillLight);
    assert.equal(run.style.fill, theme.running);
  });

  it("上下椭圆封头为 path 图元（≥2 path）", () => {
    const prims = build(false);
    const heads = prims.filter((p) => p.kind === "path");
    assert.ok(heads.length >= 2, "应有上、下两个椭圆封头 path");
    assert.ok(heads.every((p) => p.kind === "path" && p.close), "封头 path 应 close 以便填充");
  });

  it("顶部汽入口大管嘴 + 底部液出口小管嘴（顶嘴宽 > 底嘴宽）", () => {
    const prims = build(false);
    const nozzles = prims.filter((p) => p.kind === "rect" && p.w !== 34) as { w: number; y: number }[];
    assert.ok(nozzles.length >= 2, "应有顶/底两个管嘴矩形");
    const top = nozzles.find((n) => n.y < node.y)!;
    const bot = nozzles.find((n) => n.y > node.y)!;
    assert.ok(top.w > bot.w, "顶部汽入口管嘴应比底部液出口管嘴宽");
  });

  it("细节层：内部管束 ≥3 根竖细线（textMuted）", () => {
    const prims = build(false, 1);
    const tubes = prims.filter(
      (p) => p.kind === "line" && p.x1 === p.x2 && p.style.stroke === theme.textMuted,
    );
    assert.ok(tubes.length >= 3, "应有至少 3 根竖向管束细线");
  });

});
