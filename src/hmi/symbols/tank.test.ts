import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tank } from "./tank";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "TK-01", type: "tank", x: 100, y: 100, rotation: 0, label: "TK-01", topics: ["t"], bindings: {}, inline: [], };

function build(level: unknown, scale?: number, stale = false) {
  return tank.build({ node, state: { values: { level }, running: false, fault: false, stale }, theme, scale });
}

// 液体现裹在 clip 内：活数据=wave 波动，失联=rect 冻结。
function liquid(prims: ReturnType<typeof build>): { kind: string; h: number } | undefined {
  const clip = prims.find((p) => p.kind === "clip") as { children: { kind: string; h: number; style: { fill?: string } }[] } | undefined;
  return clip?.children.find((c) => (c.kind === "wave" || c.kind === "rect") && c.style.fill === theme.liquid);
}

describe("tank symbol", () => {
  it("液位 0：无液体（无 clip）", () => {
    assert.equal(liquid(build(0)), undefined);
  });
  it("液位 50：液体高度约为罐高一半，且裁剪在罐体圆角内", () => {
    const prims = build(50);
    const clip = prims.find((p) => p.kind === "clip") as { r?: number; w: number } | undefined;
    assert.ok(clip && clip.r === 3, "液位应被圆角 clip 裹住");
    assert.ok(liquid(prims)!.h > 45 && liquid(prims)!.h < 60); // 104*0.5≈52
  });
  it("活数据：液面为 wave（轻微波动）", () => {
    assert.equal(liquid(build(50))!.kind, "wave");
  });
  it("失联(stale)：液面改静态 rect（冻结不动）", () => {
    assert.equal(liquid(build(50, undefined, true))!.kind, "rect");
  });
  it("内联显示百分比文本", () => {
    const prims = build(62);
    assert.ok(prims.some((p) => p.kind === "text" && /62/.test((p as { text: string }).text)));
  });
  it("bounds 居中于节点", () => {
    const b = tank.bounds(node);
    assert.equal(b.x, 100 - 32);
    assert.equal(b.w, 64);
  });
  it("拱顶封头为 path 曲线图元", () => {
    assert.ok(build(50).some((p) => p.kind === "path"), "应有 path 拱顶");
  });
  it("造型精简：无细节层（去焊缝/支腿），缩放图元数恒定", () => {
    assert.equal(build(50, 0.5).length, build(50, 1).length);
  });
});
