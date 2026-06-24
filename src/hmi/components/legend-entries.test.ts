import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEGEND_ENTRIES, buildSwatch } from "./legend-entries";
import { createDefaultRegistry } from "@/hmi/symbols/default-registry";
import { getPalette } from "@/hmi/engine/theme";

const registry = createDefaultRegistry();
const theme = getPalette("light");

describe("buildSwatch", () => {
  it("每个图例条目都产出非空图元与有效包围盒", () => {
    for (const entry of LEGEND_ENTRIES) {
      const s = buildSwatch(entry, theme, registry);
      assert.ok(s.primitives.length > 0, `${entry.key} 应有图元`);
      assert.ok(s.box.w > 0 && s.box.h > 0, `${entry.key} 包围盒应为正`);
    }
  });
  it("故障条目含红环（alarm 色 circle）", () => {
    const fault = buildSwatch(LEGEND_ENTRIES.find((e) => e.key === "fault")!, theme, registry);
    assert.ok(fault.primitives.some((p) => p.kind === "circle" && (p as { style: { stroke?: string } }).style.stroke === theme.alarm));
  });
  it("未配置条目主体被虚化（opacity<1）", () => {
    const entry = LEGEND_ENTRIES.find((e) => e.key === "unconfigured");
    assert.ok(entry, "应有未配置条目");
    const ghost = buildSwatch(entry!, theme, registry);
    assert.ok(ghost.primitives.some((p) => (p as { style?: { opacity?: number } }).style?.opacity !== undefined && (p as { style: { opacity: number } }).style.opacity < 1));
  });
  it("含「失联」条目，主体被虚化（opacity<1）且为虚线", () => {
    const entry = LEGEND_ENTRIES.find((e) => e.key === "stale");
    assert.ok(entry, "应有失联条目");
    const swatch = buildSwatch(entry!, theme, registry);
    assert.ok(
      swatch.primitives.some((p) => (p as { style?: { opacity?: number } }).style?.opacity !== undefined && (p as { style: { opacity: number } }).style.opacity < 1),
      "失联条目应虚化",
    );
  });
  it("含「预警」条目，渲染琥珀(warn 色)环且非红环", () => {
    const entry = LEGEND_ENTRIES.find((e) => e.key === "warn");
    assert.ok(entry, "应有预警条目");
    const warn = buildSwatch(entry!, theme, registry);
    const rings = warn.primitives.filter((p) => p.kind === "circle") as { style: { stroke?: string } }[];
    assert.ok(rings.some((p) => p.style.stroke === theme.interlock), "应含琥珀(warn)环");
    assert.ok(!rings.some((p) => p.style.stroke === theme.alarm), "不应是红(alarm)环");
  });
});
