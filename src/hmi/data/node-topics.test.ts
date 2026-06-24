import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nodeTopics } from "./node-topics";

describe("nodeTopics", () => {
  it("汇总 topics / bindings / watches 的去重 topic（首见顺序）", () => {
    const r = nodeTopics({
      topics: ["t/raw"],
      bindings: {
        level: { topic: "t/lvl", path: "v" },
        flow: { topic: "t/lvl", path: "f" },
      },
      watches: [{ label: "出口压力", topic: "t/press", path: "p" }],
    });
    assert.deepEqual(
      r.map((x) => x.topic),
      ["t/raw", "t/lvl", "t/press"],
    );
  });

  it("每个 topic 带映射字段：path=负载字段(查询用)、label=元件字段/watch标签(显示用)，空 path 跳过", () => {
    const r = nodeTopics({
      topics: ["t/raw"],
      bindings: { level: { topic: "t/lvl", path: "v" }, flow: { topic: "t/lvl", path: "f" } },
      watches: [
        { label: "出口压力", topic: "t/press", path: "p" },
        { label: "无路径", topic: "t/press", path: "" },
      ],
    });
    const byTopic = Object.fromEntries(r.map((x) => [x.topic, x.fields]));
    assert.deepEqual(byTopic["t/raw"], []);
    assert.deepEqual(byTopic["t/lvl"], [
      { path: "v", label: "level" },
      { path: "f", label: "flow" },
    ]);
    assert.deepEqual(byTopic["t/press"], [{ path: "p", label: "出口压力" }]);
  });

  it("标签：绑定字段名 / watch label 优先，否则用 topic 本身", () => {
    const r = nodeTopics({
      topics: ["t/raw"],
      bindings: { level: { topic: "t/lvl", path: "v" }, flow: { topic: "t/lvl", path: "f" } },
      watches: [{ label: "出口压力", topic: "t/press", path: "p" }],
    });
    const byTopic = Object.fromEntries(r.map((x) => [x.topic, x.label]));
    assert.equal(byTopic["t/raw"], "t/raw");
    assert.equal(byTopic["t/lvl"], "level, flow");
    assert.equal(byTopic["t/press"], "出口压力");
  });

  it("空 topic 跳过；无任何 topic → []", () => {
    assert.deepEqual(nodeTopics({ topics: [""], bindings: {}, watches: [] }), []);
    assert.deepEqual(nodeTopics({}), []);
  });
});
