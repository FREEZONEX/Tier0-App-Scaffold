import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepSelection, describeSelection } from "./keyboard-nav";
import type { MimicNode } from "../schema/schema";
import type { NodeState } from "./scene";

const nodes = [
  { id: "A", type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] },
  { id: "B", type: "pump", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] },
  { id: "C", type: "valve", x: 0, y: 0, rotation: 0, label: "C 阀", topics: [], bindings: {}, inline: [] },
] as MimicNode[];

const st = (over: Partial<NodeState> = {}): NodeState => ({ values: {}, running: false, fault: false, stale: false, ...over });

describe("stepSelection", () => {
  it("未选中：next→第一个、prev→最后一个", () => {
    assert.equal(stepSelection(nodes, null, 1), "A");
    assert.equal(stepSelection(nodes, null, -1), "C");
  });
  it("循环前进/后退", () => {
    assert.equal(stepSelection(nodes, "A", 1), "B");
    assert.equal(stepSelection(nodes, "C", 1), "A"); // 末尾回绕
    assert.equal(stepSelection(nodes, "A", -1), "C"); // 开头回绕
  });
  it("未知 currentId 退回首/尾", () => {
    assert.equal(stepSelection(nodes, "ZZZ", 1), "A");
  });
  it("空场景 → null", () => {
    assert.equal(stepSelection([], null, 1), null);
  });
});

describe("describeSelection", () => {
  it("无选中 → 提示", () => {
    assert.equal(describeSelection(null, null), "未选中设备");
  });
  it("正常运行设备用 label", () => {
    assert.equal(describeSelection(nodes[2], st({ running: true })), "已选中 C 阀，运行");
  });
  it("异常优先：故障/失联", () => {
    assert.match(describeSelection(nodes[0], st({ fault: true })), /故障/);
    assert.match(describeSelection(nodes[0], st({ stale: true })), /失联/);
  });
  it("无 label 用 id", () => {
    assert.match(describeSelection(nodes[0], st()), /已选中 A/);
  });
});
