import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockSource } from "./mock-source";

describe("createMockSource", () => {
  it("tick 时按 shape 向订阅者发消息", () => {
    const source = createMockSource([
      { topic: "t/level", shape: (t) => ({ level: t }) },
    ]);
    const received: unknown[] = [];
    source.onMessage((m) => received.push(m));
    source.tick(3);
    assert.deepEqual(received, [{ topic: "t/level", payload: { level: 3 } }]);
  });

  it("connect → connected，disconnect → disconnected", () => {
    const source = createMockSource([]);
    const statuses: string[] = [];
    source.onStatus((s) => statuses.push(s));
    source.connect();
    assert.equal(source.status, "connected");
    source.disconnect();
    assert.equal(source.status, "disconnected");
    assert.deepEqual(statuses, ["connecting", "connected", "disconnected"]);
  });

  it("connect 立即发首帧（避免初期失联闪烁）", () => {
    const source = createMockSource([{ topic: "t/a", shape: () => ({ v: 1 }) }]);
    const received: unknown[] = [];
    source.onMessage((m) => received.push(m));
    source.connect();
    assert.deepEqual(received, [{ topic: "t/a", payload: { v: 1 } }]);
    source.disconnect();
  });

  it("publish 不真发、不抛错（mock 回显）", () => {
    const source = createMockSource([]);
    assert.equal(typeof source.publish, "function");
    assert.doesNotThrow(() => source.publish("cmd/pump-101", { run: true }));
  });

  it("update：按新 schema 热替换 specs，tick 改发新 topic（计时器无须重启）", () => {
    const source = createMockSource([{ topic: "t/old", shape: () => ({ v: 1 }) }]);
    const topics: string[] = [];
    source.onMessage((m) => topics.push(m.topic));
    source.tick(0);
    assert.deepEqual(topics, ["t/old"]);
    // 改 schema：含一个绑定到 t/new 的节点 → specs 重算
    const schema = {
      meta: { name: "x", version: 1 },
      nodes: [{ id: "n1", type: "tank", x: 0, y: 0, topics: ["t/new"], bindings: {} }],
      edges: [],
    } as unknown as Parameters<typeof source.update>[0];
    source.update(schema, ["t/new"]);
    topics.length = 0;
    source.tick(1);
    assert.deepEqual(topics, ["t/new"], "热替换后只发新 schema 的 topic");
  });
});
