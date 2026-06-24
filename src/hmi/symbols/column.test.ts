import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { column } from "./column";
import { getPalette } from "../engine/theme";
import type { MimicNode } from "../schema/schema";

const theme = getPalette("light");
const base: MimicNode = { id: "T-01", type: "column", x: 100, y: 100, rotation: 0, label: "T-01", topics: [], bindings: {}, inline: [] };

const build = (values: Record<string, unknown> = {}, over: Partial<MimicNode> = {}, scale?: number) =>
  column.build({ node: { ...base, ...over }, state: { values, running: false, fault: false, stale: false }, theme, scale });

describe("column symbol", () => {
  it("产出本体图元", () => {
    assert.ok(build().length > 0);
  });

  it("含直筒塔体 rect（fillLight 本体）", () => {
    const prims = build();
    const body = prims.find((p) => p.kind === "rect") as { style: { fill?: string } } | undefined;
    assert.equal(body?.style.fill, theme.fillLight);
  });

  it("上下椭圆封头为 path 图元（≥2 条曲线封头）", () => {
    const prims = build();
    const domes = prims.filter((p) => p.kind === "path");
    assert.ok(domes.length >= 2, "应有上下两个 path 封头");
    // 封头 close 后填充静止本体色
    for (const d of domes) {
      assert.equal((d as { style: { fill?: string } }).style.fill, theme.fillLight);
      assert.ok((d as { close?: boolean }).close, "封头应 close 后填充");
    }
  });

  it("底部为半圆碟底（A 弧 path），不再用裙座 polygon", () => {
    const prims = build();
    assert.ok(!prims.some((p) => p.kind === "polygon"), "裙座已移除，不应有 polygon");
    const arcs = prims.filter((p) => p.kind === "path") as { d: readonly { c: string }[] }[];
    assert.ok(arcs.some((p) => p.d.some((cmd) => cmd.c === "A")), "底封头应含 A 弧（半圆碟底）");
  });

  it("含 5 条等距横向塔盘线（辨识特征，textMuted 细线）", () => {
    const prims = build();
    const trays = prims.filter(
      (p) => p.kind === "line" && (p as { style: { strokeWidth?: number; stroke?: string } }).style.strokeWidth === 1 && (p as { style: { stroke?: string } }).style.stroke === theme.textMuted,
    );
    assert.equal(trays.length, 5, "塔盘线应为 5 条");
    // 等距校验：相邻 y 间距一致
    const ys = trays.map((p) => (p as { y1: number }).y1);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]);
    for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-6, "塔盘等距");
  });

  it("含左右侧进料/回流 2 短管管嘴（细节层小矩形）", () => {
    const prims = build();
    const nozzles = prims.filter(
      (p) => p.kind === "rect" && (p as { style: { strokeWidth?: number } }).style.strokeWidth === 1.25,
    );
    assert.equal(nozzles.length, 2, "应有左右各一管嘴");
  });

  it("level 驱动塔釜液位高度（clip + liquid）", () => {
    const lo = build({ level: 20 });
    const hi = build({ level: 80 });
    const clipLo = lo.find((p) => p.kind === "clip") as { children: readonly { kind: string; h: number; style: { fill?: string } }[] } | undefined;
    const clipHi = hi.find((p) => p.kind === "clip") as { children: readonly { kind: string; h: number }[] } | undefined;
    assert.ok(clipLo && clipHi, "应有液位裁剪组");
    assert.equal(clipLo!.children[0].style.fill, theme.liquid, "液位用 theme.liquid");
    assert.ok(clipHi!.children[0].h > clipLo!.children[0].h, "level 越高液位越高");
  });

  it("level=0 时不绘制液位 clip", () => {
    const prims = build({ level: 0 });
    assert.ok(!prims.some((p) => p.kind === "clip"));
  });

  it("temp 有值时塔身显示温度文本", () => {
    const prims = build({ temp: 152 });
    assert.ok(prims.some((p) => p.kind === "text" && (p as { text: string }).text === "152°"));
  });

  it("temp 为脏数据时不绘制温度文本", () => {
    const prims = build({ temp: "n/a" });
    assert.ok(!prims.some((p) => p.kind === "text" && (p as { text: string }).text.endsWith("°")));
  });

  it("有 watchReadouts：逐塔盘竖直平铺读数文本（多塔盘温度贴身）", () => {
    const prims = column.build({
      node: base,
      state: {
        values: {}, running: false, fault: false, stale: false,
        watchReadouts: [
          { label: "上部温度", value: 144.1, unit: "°C" },
          { label: "中部温度", value: 146.06, unit: "°C" },
          { label: "塔釜温度", value: 150.9, unit: "°C", level: "alarm" },
        ],
      },
      theme,
    });
    const texts = prims.filter((p) => p.kind === "text") as { text: string; x: number; y: number; style: { fill?: string } }[];
    // 三条读数（1 位小数 + 单位）
    assert.ok(texts.some((t) => t.text === "144.1°C"));
    assert.ok(texts.some((t) => t.text === "146.1°C"));
    assert.ok(texts.some((t) => t.text === "150.9°C"));
    // 自上而下：y 递增
    const ys = texts.filter((t) => /^\d/.test(t.text)).map((t) => t.y);
    assert.deepEqual([...ys], [...ys].sort((a, b) => a - b));
    // 告警读数变红
    assert.equal(texts.find((t) => t.text === "150.9°C")?.style.fill, theme.alarm);
  });

  it("有 watchReadouts 时不再显示单中部温度（watches 优先）", () => {
    const prims = column.build({
      node: base,
      state: { values: { temp: 152 }, running: false, fault: false, stale: false, watchReadouts: [{ label: "T", value: 100 }] },
      theme,
    });
    assert.ok(!prims.some((p) => p.kind === "text" && (p as { text: string }).text === "152°"));
  });

  it("bounds 居中包住瘦高塔体（细长比 ≥ 3.5）", () => {
    const b = column.bounds(base);
    assert.equal(b.x + b.w / 2, base.x);
    assert.ok(b.h > b.w, "塔器应瘦高");
    assert.ok(b.h / b.w >= 3.5, "细长比应 ≥ 3.5");
  });

});
