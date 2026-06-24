import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rememberUnsTopicFields, unsTopicFields, unsTopicFieldSchema, examplePayloadJson } from "./uns-topic-fields";

describe("uns-topic-fields", () => {
  it("记住并取回字段名", () => {
    rememberUnsTopicFields("t/a", [{ name: "oee_score" }, { name: "availability" }]);
    assert.deepEqual(unsTopicFields("t/a"), ["oee_score", "availability"]);
  });

  it("未知 topic → 空数组", () => {
    assert.deepEqual(unsTopicFields("t/none"), []);
    assert.deepEqual(unsTopicFieldSchema("t/none"), []);
  });

  it("空字段不写入", () => {
    rememberUnsTopicFields("t/b", []);
    assert.deepEqual(unsTopicFields("t/b"), []);
  });

  it("保留字段类型供示例 payload", () => {
    rememberUnsTopicFields("t/typed", [
      { name: "rpm", type: "number" },
      { name: "name", type: "string" },
      { name: "on", type: "boolean" },
    ]);
    assert.deepEqual(unsTopicFieldSchema("t/typed"), [
      { name: "rpm", type: "number" },
      { name: "name", type: "string" },
      { name: "on", type: "boolean" },
    ]);
  });
});

describe("examplePayloadJson", () => {
  it("按字段类型给默认值：number→0、boolean→false、string→\"\"", () => {
    const json = examplePayloadJson([
      { name: "rpm", type: "number" },
      { name: "name", type: "string" },
      { name: "running", type: "boolean" },
    ]);
    assert.equal(json, JSON.stringify({ rpm: 0, name: "", running: false }));
  });

  it("识别 int/float/double→0、bool→false", () => {
    const json = examplePayloadJson([
      { name: "a", type: "int" },
      { name: "b", type: "float" },
      { name: "c", type: "double" },
      { name: "d", type: "integer" },
      { name: "e", type: "bool" },
    ]);
    assert.equal(json, JSON.stringify({ a: 0, b: 0, c: 0, d: 0, e: false }));
  });

  it("类型未知或缺失 → 当字符串默认 \"\"", () => {
    const json = examplePayloadJson([{ name: "x" }, { name: "y", type: "weird" }]);
    assert.equal(json, JSON.stringify({ x: "", y: "" }));
  });

  it("无字段 → undefined（不强行回填）", () => {
    assert.equal(examplePayloadJson([]), undefined);
  });

  it("字段全无 name → undefined", () => {
    assert.equal(examplePayloadJson([{ name: "", type: "number" }]), undefined);
  });
});
