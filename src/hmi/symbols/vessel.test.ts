import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vessel } from "./vessel";
import { getPalette } from "../engine/theme";
import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";

const theme = getPalette("light");
const base: MimicNode = { id: "R-01", type: "vessel", x: 100, y: 100, rotation: 0, label: "R-01", topics: [], bindings: {}, inline: [] };

/** build 辅助：可选透传 scale，默认 1:1。 */
function build(node: MimicNode, state: NodeState, scale?: number) {
  return vessel.build({ node, state, theme, scale });
}

describe("vessel symbol", () => {
  it("含釜体 path 外轮廓 + 顶部搅拌口短管 + 液位 clip", () => {
    const prims = build({ ...base, props: {} }, { values: { level: 60 }, running: false, fault: false, stale: false });
    assert.ok(prims.some((p) => p.kind === "path"), "封头椭圆弧 path 外轮廓");
    assert.ok(prims.some((p) => p.kind === "rect"), "顶部搅拌口短管 rect");
    assert.ok(prims.some((p) => p.kind === "clip"), "液位裁剪");
  });
  it("封头为 path 图元：上下椭圆弧用 Q 贝塞尔（替代直边顶底）", () => {
    const prims = build({ ...base, props: {} }, { values: { level: 0 }, running: false, fault: false, stale: false });
    const body = prims.find((p) => p.kind === "path") as { d: readonly { c: string }[] } | undefined;
    assert.ok(body, "存在 path 外轮廓");
    const qCount = body!.d.filter((cmd) => cmd.c === "Q").length;
    assert.ok(qCount >= 2, "上下两道封头椭圆弧（各一 Q 命令）");
  });
  it("细节层夹套第二轮廓：1:1 含内缩夹套 path（>=2 个 path）", () => {
    // level=0 排除底封头灌液 path 干扰，纯测夹套存在
    const full = build({ ...base, props: {} }, { values: { level: 0 }, running: false, fault: false, stale: false }, 1);
    assert.ok(full.filter((p) => p.kind === "path").length >= 2, "1:1 含釜体+夹套两条 path");
  });

  it("有液位：底封头也灌液（液面从视觉底起，不悬空）", () => {
    const liq = build({ ...base, props: {} }, { values: { level: 50 }, running: false, fault: false, stale: false });
    assert.ok(liq.some((p) => p.kind === "path" && (p as { style: { fill?: string } }).style.fill === theme.liquid), "应有底封头 liquid 填充 path");
  });
  it("agitator=true：含搅拌电机箱 + 轴 + 叶轮，运行时电机箱深填充", () => {
    const prims = build({ ...base, props: { agitator: true } }, { values: { level: 50 }, running: true, fault: false, stale: false });
    const boxes = prims.filter((p) => p.kind === "rect");
    assert.ok(boxes.some((p) => (p as { style: { fill?: string } }).style.fill === theme.running), "运行→电机箱深填充");
  });
  it("agitator 静止：电机箱浅填充（状态语义不变）", () => {
    const prims = build({ ...base, props: { agitator: true } }, { values: { level: 50 }, running: false, fault: false, stale: false });
    const boxes = prims.filter((p) => p.kind === "rect") as { style: { fill?: string } }[];
    assert.ok(boxes.every((p) => p.style.fill !== theme.running), "静止→无深填充电机箱");
  });
  it("agitator=false：无搅拌器（接收罐）图元更少", () => {
    const withAgi = build({ ...base, props: { agitator: true } }, { values: {}, running: false, fault: false, stale: false });
    const noAgi = build({ ...base, props: {} }, { values: {}, running: false, fault: false, stale: false });
    assert.ok(withAgi.length > noAgi.length, "搅拌器增加图元");
  });
  it("液位裁剪到壳体直筒矩形内（liquid 填充 = theme.liquid）", () => {
    const prims = build(base, { values: { level: 80 }, running: false, fault: false, stale: false });
    const clip = prims.find((p) => p.kind === "clip") as { children: readonly { style: { fill?: string } }[] } | undefined;
    assert.ok(clip, "存在液位 clip");
    assert.equal(clip!.children[0].style.fill, theme.liquid, "液位填充用 theme.liquid");
  });
});
