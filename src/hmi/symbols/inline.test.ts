import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatInlineValue, inlineLine } from "./inline";
import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";

describe("formatInlineValue", () => {
  it("数字带单位（传入 unit 才追加，不内置推断）", () => {
    assert.equal(formatInlineValue("rpm", 1480, "rpm"), "1480 rpm");
    assert.equal(formatInlineValue("flow", 17.234, "m³/h"), "17.2 m³/h");
  });
  it("无 unit → 只显示数字（含原 level/temp 等，不再硬加 % / ℃）", () => {
    assert.equal(formatInlineValue("foo", 3.14159), "3.1");
    assert.equal(formatInlineValue("level", 62), "62");
    assert.equal(formatInlineValue("temp", 25), "25");
  });
  it("布尔按 key 映射中文状态", () => {
    assert.equal(formatInlineValue("running", true), "运行");
    assert.equal(formatInlineValue("running", false), "停止");
    assert.equal(formatInlineValue("open", true), "开");
    assert.equal(formatInlineValue("open", false), "关");
  });
  it("未知布尔 key 回落 on/off", () => {
    assert.equal(formatInlineValue("flag", true), "on");
  });
  it("缺失值显示占位", () => {
    assert.equal(formatInlineValue("rpm", undefined), "--");
    assert.equal(formatInlineValue("rpm", null), "--");
  });
  it("数字型字符串按数字处理（传入 unit 才带单位）", () => {
    assert.equal(formatInlineValue("level", "62", "%"), "62 %");
    assert.equal(formatInlineValue("level", "62"), "62");
  });
  it("布尔语义 key 接受字符串/数字", () => {
    assert.equal(formatInlineValue("running", "true"), "运行");
    assert.equal(formatInlineValue("open", 0), "关");
  });
  it("脏数据回落占位：NaN / 对象 / 空串", () => {
    assert.equal(formatInlineValue("rpm", Number.NaN), "--");
    assert.equal(formatInlineValue("rpm", { a: 1 }), "--");
    assert.equal(formatInlineValue("rpm", ""), "--");
  });
});

const node = (inline: string[]): MimicNode => ({
  id: "X", type: "pump", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline,
});
const state = (values: Record<string, unknown>, units?: Record<string, string>): NodeState => ({
  values, units, running: false, fault: false, stale: false,
});

describe("inlineLine", () => {
  it("拼接配置的 inline 字段，· 分隔（单位取 state.units）", () => {
    assert.equal(
      inlineLine(node(["rpm", "running"]), state({ rpm: 1480, running: true }, { rpm: "rpm" })),
      "1480 rpm · 运行",
    );
  });
  it("无 units → 数字不带单位", () => {
    assert.equal(inlineLine(node(["rpm"]), state({ rpm: 1480 })), "1480");
  });
  it("空 inline 返回空串", () => {
    assert.equal(inlineLine(node([]), state({ rpm: 1 })), "");
  });
});
