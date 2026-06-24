import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSignal } from "./resolve-signal";
import type { Binding } from "../schema/schema";

const b = (over: Partial<Binding> = {}): Binding => ({ topic: "t", path: "p", ...over });

describe("resolveSignal — 无数据/直通", () => {
  it("undefined/null → stale", () => {
    assert.deepEqual(resolveSignal(b(), undefined), { value: undefined, level: "normal", quality: "stale" });
    assert.equal(resolveSignal(b(), null).quality, "stale");
  });
  it("无映射：原始值直通（good）", () => {
    assert.deepEqual(resolveSignal(b(), true), { value: true, level: "normal", quality: "good" });
    assert.deepEqual(resolveSignal(b(), 42), { value: 42, level: "normal", quality: "good" });
    assert.deepEqual(resolveSignal(b(), "RUN"), { value: "RUN", level: "normal", quality: "good" });
  });
});

describe("resolveSignal — map 吃五花八门", () => {
  it("字符串/中文 → 布尔", () => {
    const m = b({ map: { OPEN: true, CLOSED: false, "运行": true, "停止": false } });
    assert.equal(resolveSignal(m, "OPEN").value, true);
    assert.equal(resolveSignal(m, "运行").value, true);
    assert.equal(resolveSignal(m, "停止").value, false);
  });
  it("多态枚举码（数字键以字符串匹配）", () => {
    const m = b({ map: { "0": false, "1": true, "2": true } });
    assert.equal(resolveSignal(m, 0).value, false);
    assert.equal(resolveSignal(m, 1).value, true);
    assert.equal(resolveSignal(m, 2).value, true);
  });
  it("配了 map 但原始值不在表内 → unknown（显式可见）", () => {
    const r = resolveSignal(b({ map: { "0": false, "1": true } }), 9);
    assert.equal(r.quality, "unknown");
    assert.equal(r.value, 9);
  });
  it("invert 反逻辑（仅对布尔结果）", () => {
    assert.equal(resolveSignal(b({ map: { "0": true, "1": false }, invert: true }), 0).value, false);
    assert.equal(resolveSignal(b({ invert: true }), 5).value, 5); // 非布尔不翻转
  });
});

describe("resolveSignal — test 比较条件（开关不限等值）", () => {
  it("eq 等值（逗号多值）", () => {
    assert.equal(resolveSignal(b({ test: { op: "eq", value: "OPEN,1" } }), "OPEN").value, true);
    assert.equal(resolveSignal(b({ test: { op: "eq", value: "OPEN,1" } }), 1).value, true);
    assert.equal(resolveSignal(b({ test: { op: "eq", value: "OPEN" } }), "CLOSED").value, false);
  });
  it("ne 不等于", () => {
    assert.equal(resolveSignal(b({ test: { op: "ne", value: "0" } }), 5).value, true);
    assert.equal(resolveSignal(b({ test: { op: "ne", value: "0" } }), 0).value, false);
  });
  it("gt/lt/ge/le 数值比较", () => {
    assert.equal(resolveSignal(b({ test: { op: "gt", value: "5" } }), 6).value, true);
    assert.equal(resolveSignal(b({ test: { op: "gt", value: "5" } }), 5).value, false);
    assert.equal(resolveSignal(b({ test: { op: "ge", value: "5" } }), 5).value, true);
    assert.equal(resolveSignal(b({ test: { op: "lt", value: "5" } }), 4).value, true);
    assert.equal(resolveSignal(b({ test: { op: "le", value: "5" } }), 5).value, true);
  });
  it("非数值做大小比较 → false", () => {
    assert.equal(resolveSignal(b({ test: { op: "gt", value: "5" } }), "abc").value, false);
  });
  it("test 优先于 map", () => {
    assert.equal(resolveSignal(b({ test: { op: "gt", value: "5" }, map: { "6": false } }), 6).value, true);
  });
});

describe("resolveSignal — test/testOff 开关各自独立", () => {
  it("只配开(test)：其余取补=关", () => {
    assert.equal(resolveSignal(b({ test: { op: "eq", value: "1" } }), 1).value, true);
    assert.equal(resolveSignal(b({ test: { op: "eq", value: "1" } }), 0).value, false);
  });
  it("只配关(testOff)：其余取补=开", () => {
    assert.equal(resolveSignal(b({ testOff: { op: "eq", value: "0" } }), 0).value, false);
    assert.equal(resolveSignal(b({ testOff: { op: "eq", value: "0" } }), 9).value, true);
  });
  it("两者各自独立命中：开→真、关→假", () => {
    const both = b({ test: { op: "eq", value: "1,RUN" }, testOff: { op: "eq", value: "0,STOP" } });
    assert.equal(resolveSignal(both, "RUN").value, true);
    assert.equal(resolveSignal(both, 1).value, true);
    assert.equal(resolveSignal(both, "STOP").value, false);
    assert.equal(resolveSignal(both, 0).value, false);
  });
  it("两者都配且都不命中 → 未知（不静默猜）", () => {
    const both = b({ test: { op: "eq", value: "1" }, testOff: { op: "eq", value: "0" } });
    const r = resolveSignal(both, 9);
    assert.equal(r.quality, "unknown");
    assert.equal(r.value, 9);
  });
  it("两者都命中（条件重叠）→ 开优先", () => {
    const both = b({ test: { op: "ge", value: "5" }, testOff: { op: "le", value: "10" } });
    assert.equal(resolveSignal(both, 7).value, true); // 7 同时满足 ≥5 与 ≤10，开优先
  });
  it("阈值比较组合：开 当 >80、关 当 <20，中间→未知", () => {
    const both = b({ test: { op: "gt", value: "80" }, testOff: { op: "lt", value: "20" } });
    assert.equal(resolveSignal(both, 90).value, true);
    assert.equal(resolveSignal(both, 10).value, false);
    assert.equal(resolveSignal(both, 50).quality, "unknown");
  });
});

describe("resolveSignal — scale 量程→视觉比例（值保留原始）", () => {
  it("工程量 [min,max] → fraction 0–100，value 保留原始", () => {
    const r = resolveSignal(b({ scale: { min: 0, max: 1600 } }), 800);
    assert.equal(r.value, 800);
    assert.equal(r.fraction, 50);
    assert.equal(resolveSignal(b({ scale: { min: 0, max: 1600 } }), 1600).fraction, 100);
  });
  it("字符串数值：value 为数值原值，fraction 为比例", () => {
    const r = resolveSignal(b({ scale: { min: 0, max: 200 } }), "100");
    assert.equal(r.value, 100);
    assert.equal(r.fraction, 50);
  });
  it("无 scale：数值直通，无 fraction", () => {
    const r = resolveSignal(b(), 73);
    assert.equal(r.value, 73);
    assert.equal(r.fraction, undefined);
  });
});

describe("resolveSignal — alarms 判阈（原始值）", () => {
  const lim = b({ alarms: { hi: 90, hihi: 95, lo: 10, lolo: 5 } });
  it("hihi/lolo → alarm；hi/lo → warn；区间内 → normal", () => {
    assert.equal(resolveSignal(lim, 50).level, "normal");
    assert.equal(resolveSignal(lim, 92).level, "warn");
    assert.equal(resolveSignal(lim, 96).level, "alarm");
    assert.equal(resolveSignal(lim, 8).level, "warn");
    assert.equal(resolveSignal(lim, 3).level, "alarm");
  });
  it("阈值判原始值（scale 仅算视觉比例，不影响判阈）", () => {
    // 量程 0–1600 → fraction；阈值按工程原始值判：1520 ≥ hihi 1500 → alarm
    const r = resolveSignal(b({ scale: { min: 0, max: 1600 }, alarms: { hihi: 1500 } }), 1520);
    assert.equal(r.value, 1520);
    assert.equal(r.fraction, 95);
    assert.equal(r.level, "alarm");
  });
});
