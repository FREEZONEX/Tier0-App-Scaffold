import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toBool, toFiniteNumber, clampPct } from "./coerce";

describe("toBool", () => {
  it("bool 原样、number 非 0", () => {
    assert.equal(toBool(true), true);
    assert.equal(toBool(false), false);
    assert.equal(toBool(0), false);
    assert.equal(toBool(3), true);
  });
  it("真值字符串白名单（大小写/空白无关）", () => {
    for (const s of ["1", "true", "ON", " yes ", "open", "run", "running", "Active"]) {
      assert.equal(toBool(s), true, s);
    }
    for (const s of ["0", "false", "off", "no", "", "closed", "stop"]) {
      assert.equal(toBool(s), false, s);
    }
  });
  it("非标量 → false", () => {
    assert.equal(toBool(undefined), false);
    assert.equal(toBool(null), false);
    assert.equal(toBool({}), false);
  });
});

describe("toFiniteNumber", () => {
  it("有限数原样，非有限走 fallback", () => {
    assert.equal(toFiniteNumber(5), 5);
    assert.equal(toFiniteNumber("5.5"), 5.5);
    assert.equal(toFiniteNumber(NaN, -1), -1);
    assert.equal(toFiniteNumber(Infinity, -1), -1);
  });
  it("空串/空白串 → fallback（不当 0）", () => {
    assert.equal(toFiniteNumber("", -1), -1);
    assert.equal(toFiniteNumber("   ", -1), -1);
    assert.ok(Number.isNaN(toFiniteNumber("")));
  });
  it("非数字串/对象 → fallback", () => {
    assert.equal(toFiniteNumber("abc", -1), -1);
    assert.equal(toFiniteNumber({}, -1), -1);
  });
});

describe("clampPct", () => {
  it("钳到 0..100，非数 → 0", () => {
    assert.equal(clampPct(50), 50);
    assert.equal(clampPct(-5), 0);
    assert.equal(clampPct(140), 100);
    assert.equal(clampPct("75"), 75);
    assert.equal(clampPct("abc"), 0);
    assert.equal(clampPct(""), 0);
    assert.equal(clampPct(undefined), 0);
  });
});
