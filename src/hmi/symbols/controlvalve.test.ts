import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { controlvalve, discAngleDeg } from "./controlvalve";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const mk = (over = {}) => ({ id: "FV-01", type: "controlvalve", x: 100, y: 100, rotation: 0, label: "FV-01", topics: [], bindings: {}, inline: [], ...over });
const build = (values = {}, st: { node?: object } = {}, scale?: number) =>
  controlvalve.build({ node: mk(st.node), state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

function polys(values: object) {
  return build(values).filter((p) => p.kind === "polygon") as { points: readonly (readonly [number, number])[]; style: { fill?: string } }[];
}

describe("controlvalve symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("蝶形双三角阀体：2 个 polygon（膜头改 path 半圆拱，不再是 polygon）", () => {
    assert.equal(polys({}).length, 2);
  });

  it("开度>0：阀体深填充（激活·醒目）", () => {
    // 两个 polygon = 阀体双三角
    const body = polys({ opening: 60 });
    assert.equal(body[0].style.fill, theme.running);
    assert.equal(body[1].style.fill, theme.running);
  });

  it("开度=0：阀体浅填充（静止）", () => {
    const body = polys({ opening: 0 });
    assert.equal(body[0].style.fill, theme.fillLight);
    assert.equal(body[1].style.fill, theme.fillLight);
  });

  it("缺省/非数 opening 视为 0：浅填充", () => {
    assert.equal(polys({}).length > 0 && polys({})[0].style.fill, theme.fillLight);
    assert.equal(polys({ opening: "x" })[0].style.fill, theme.fillLight);
  });

  it("膜头执行器为半圆拱 path（A 弧顶），位于阀体上方", () => {
    const path = build({}).find((p) => p.kind === "path") as
      | { d: readonly { c: string; cy?: number; r?: number }[]; close?: boolean }
      | undefined;
    assert.ok(path, "应存在膜头半圆拱 path 图元");
    // 含一条 A 弧指令（半圆拱）
    const arc = path!.d.find((cmd) => cmd.c === "A");
    assert.ok(arc, "膜头 path 应含 A 弧指令");
    // 弧圆心位于中心上方（拱顶高于阀体）
    assert.ok((arc!.cy ?? 0) < 100, "膜头半圆拱应位于中心上方");
    // close 后可填充
    assert.equal(path!.close, true);
  });

  it("有膜片横线（半圆拱底直径）", () => {
    const lines = build({}).filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    // 一条水平线、位于中心上方、左右对称跨过 cx
    const diaph = lines.find((l) => l.y1 === l.y2 && l.y1 < 100 && l.x1 < 100 && l.x2 > 100);
    assert.ok(diaph, "应存在一条横向膜片线");
  });

  it("有竖直阀杆连接阀体与膜头", () => {
    const lines = build({}).filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    const stem = lines.find((l) => l.x1 === 100 && l.x2 === 100 && l.y1 < 100 && l.y2 < l.y1);
    assert.ok(stem, "应存在一条竖直向上的阀杆 line");
  });

  it("左右两侧有水平管嘴", () => {
    const lines = build({}).filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    const left = lines.find((l) => l.y1 === 100 && l.y2 === 100 && l.x1 < 100 && l.x2 < 100);
    const right = lines.find((l) => l.y1 === 100 && l.y2 === 100 && l.x1 > 100 && l.x2 > 100);
    assert.ok(left, "应有左管嘴");
    assert.ok(right, "应有右管嘴");
  });

  it("造型精简：无细节层（去侧挂定位器小方块），缩放图元数恒定", () => {
    assert.equal(build({}, {}, 0.5).length, build({}, {}, 1).length);
  });

  it("opening 进入内联字段（标签下方实时值）", () => {
    const node = mk({ inline: ["opening"] });
    const prims = controlvalve.build({ node, state: { values: { opening: 42 }, running: false, fault: false, stale: false }, theme });
    const texts = prims.filter((p) => p.kind === "text") as { text: string }[];
    assert.ok(texts.some((t) => t.text.includes("42")));
  });

  it("bounds 包含膜头顶部（高于阀体）", () => {
    const b = controlvalve.bounds(mk());
    assert.ok(b.y < 100 - 13, "包围盒上沿应高于阀体顶");
    assert.ok(b.h > 26, "包围盒应覆盖膜头+阀体整体");
  });

  it("discAngleDeg：开度→碟片倾角线性（0%=90°挡流、50%=45°、100%=0°顺流）", () => {
    assert.equal(discAngleDeg(0), 90);
    assert.equal(discAngleDeg(50), 45);
    assert.equal(discAngleDeg(100), 0);
    // 越界夹紧
    assert.equal(discAngleDeg(-20), 90);
    assert.equal(discAngleDeg(140), 0);
  });

  // 碟片线：唯一中点恰在阀芯中心 (100,100) 的 line
  function disc(values: object) {
    const lines = build(values).filter((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number }[];
    return lines.find((l) => Math.abs((l.x1 + l.x2) / 2 - 100) < 1e-6 && Math.abs((l.y1 + l.y2) / 2 - 100) < 1e-6);
  }
  const tilt = (l: { x1: number; y1: number; x2: number; y2: number }) => Math.abs(Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI) % 180;

  it("碟片随开度联动：全关近垂直、全开近水平、不同开度角度不同", () => {
    const closed = disc({ opening: 0 })!;
    const open = disc({ opening: 100 })!;
    const half = disc({ opening: 50 })!;
    assert.ok(closed, "应存在碟片线");
    assert.ok(Math.abs(tilt(closed) - 90) < 1e-6, "全关碟片垂直(90°挡流)");
    assert.ok(tilt(open) < 1e-6, "全开碟片水平(0°顺流)");
    assert.ok(Math.abs(tilt(half) - 45) < 1e-6, "半开 45°");
  });
});
