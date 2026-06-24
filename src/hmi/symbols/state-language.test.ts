import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDecoration } from "./state-language";
import type { NodeState } from "../scene/scene";

const base: NodeState = { values: {}, running: false, fault: false, stale: false };

describe("resolveDecoration", () => {
  it("正常未选中：无环无角标不闪", () => {
    const d = resolveDecoration(base, false);
    assert.deepEqual(d, { ring: "none", badge: "none", blink: false, faded: false, dashed: false, interlockKind: undefined });
  });
  it("选中：青绿环", () => {
    assert.equal(resolveDecoration(base, true).ring, "selection");
  });
  it("故障：红环 + 故障角标 + 慢闪，优先于选中", () => {
    const d = resolveDecoration({ ...base, fault: true }, true);
    assert.equal(d.ring, "fault");
    assert.equal(d.badge, "fault");
    assert.equal(d.blink, true);
  });
  it("失联：虚线 + 褪色 + 失联角标", () => {
    const d = resolveDecoration({ ...base, stale: true }, false);
    assert.equal(d.dashed, true);
    assert.equal(d.faded, true);
    assert.equal(d.badge, "stale");
  });
  it("第3参 locked=true 点亮联锁角标", () => {
    assert.equal(resolveDecoration(base, false, true).badge, "interlock");
  });
  it("legacy values.interlock 点亮联锁角标", () => {
    assert.equal(resolveDecoration({ ...base, values: { interlock: true } }, false).badge, "interlock");
  });
  it("故障优先于联锁", () => {
    assert.equal(resolveDecoration({ ...base, fault: true }, false, true).badge, "fault");
  });
  it("高报 warn：琥珀环、稳定不闪", () => {
    const d = resolveDecoration({ ...base, alarm: "warn" }, false);
    assert.equal(d.ring, "warn");
    assert.equal(d.blink, false);
  });
  it("故障优先于 warn", () => {
    assert.equal(resolveDecoration({ ...base, fault: true, alarm: "warn" }, false).ring, "fault");
  });
  it("quality unknown → 当作不可信（褪色虚线 + ? 角标）", () => {
    const d = resolveDecoration({ ...base, quality: "unknown" }, false);
    assert.equal(d.badge, "stale");
    assert.equal(d.faded, true);
    assert.equal(d.dashed, true);
  });
  it("未配置：虚化（褪色、实线、无角标），区别于失联（无 ? 角标、不虚线）", () => {
    const d = resolveDecoration({ ...base, unconfigured: true }, false);
    assert.equal(d.faded, true);
    assert.equal(d.dashed, false);
    assert.equal(d.badge, "none");
  });
  it("未配置仍显示选中环", () => {
    assert.equal(resolveDecoration({ ...base, unconfigured: true }, true).ring, "selection");
  });
  it("未配置优先于失联（无数据时虚化为准）", () => {
    const d = resolveDecoration({ ...base, unconfigured: true, stale: true }, false);
    assert.equal(d.dashed, false);
    assert.equal(d.badge, "none");
  });
});
