import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schemaTopics } from "./topics";
import { parseMimic } from "./schema";

const mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "A", type: "tank", x: 0, y: 0, topics: ["t/a"], bindings: { level: { topic: "t/a", path: "l" } } },
    { id: "B", type: "pump", x: 0, y: 0, topics: ["t/b"], bindings: { rpm: { topic: "t/b2", path: "r" } } },
  ],
  edges: [{ id: "e", from: "A", to: "B", points: [[0, 0], [1, 1]], flowBy: { topic: "t/flow", path: "f" } }],
}).data!;

describe("schemaTopics", () => {
  it("收集节点 topics + 绑定 topic + 边 flowBy，去重", () => {
    assert.deepEqual(schemaTopics(mimic).sort(), ["t/a", "t/b", "t/b2", "t/flow"]);
  });
  it("空 schema 返回空数组", () => {
    const empty = parseMimic({ meta: { name: "x", version: 1 }, nodes: [], edges: [] }).data!;
    assert.deepEqual(schemaTopics(empty), []);
  });
});
