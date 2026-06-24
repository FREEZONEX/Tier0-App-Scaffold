import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTier0Source, type Tier0ClientLike } from "./tier0-source";

function makeFake() {
  const subs: Array<{ topic: string; h: (t: string, p: string) => void }> = [];
  const unsubs: string[] = [];
  const pubs: Array<{ topic: string; payload: unknown }> = [];
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  const client: Tier0ClientLike = {
    subscribe(topic, h) { subs.push({ topic, h }); },
    unsubscribe(topic) { unsubs.push(topic); },
    publish(topic, payload) { pubs.push({ topic, payload }); return Promise.resolve(); },
    on(ev, cb) { (handlers[ev] ??= []).push(cb as (...a: unknown[]) => void); },
    disconnect() {},
  };
  return { client, subs, unsubs, pubs, emit: (ev: string, ...a: unknown[]) => handlers[ev]?.forEach((c) => c(...a)) };
}

// update 测试用最小 schema（tier0 忽略 schema 参数，仅用 topics）。
const SCHEMA = { meta: { name: "x", version: 1 }, nodes: [], edges: [] } as unknown as Parameters<ReturnType<typeof createTier0Source>["update"]>[0];

describe("tier0-source", () => {
  it("connect → 订阅 topics，on(connect) → status connected", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a", "t/b"], () => fake.client);
    src.connect();
    assert.equal(src.status, "connecting");
    assert.deepEqual(fake.subs.map((s) => s.topic), ["t/a", "t/b"]);
    fake.emit("connect");
    assert.equal(src.status, "connected");
  });

  it("subscribe handler 收到消息 → onMessage 转发（JSON parse）", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a"], () => fake.client);
    const got: unknown[] = [];
    src.onMessage((m) => got.push(m));
    src.connect();
    fake.subs[0].h("t/a", '{"v":1}');
    assert.deepEqual(got, [{ topic: "t/a", payload: { v: 1 } }]);
  });

  it("publish → client.publish", () => {
    const fake = makeFake();
    const src = createTier0Source([], () => fake.client);
    src.connect();
    src.publish("cmd/x", { run: true });
    assert.deepEqual(fake.pubs, [{ topic: "cmd/x", payload: { run: true } }]);
  });

  it("disconnect → status disconnected", () => {
    const fake = makeFake();
    const src = createTier0Source([], () => fake.client);
    src.connect();
    src.disconnect();
    assert.equal(src.status, "disconnected");
  });

  it("update：仅对新增 topic subscribe（只新增的拿 retain），不重订已有", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a"], () => fake.client);
    src.connect();
    assert.deepEqual(fake.subs.map((s) => s.topic), ["t/a"]);
    src.update(SCHEMA, ["t/a", "t/b"]); // 新增 t/b
    assert.deepEqual(fake.subs.map((s) => s.topic), ["t/a", "t/b"], "只补订 t/b，t/a 不重订");
    assert.deepEqual(fake.unsubs, []);
  });

  it("update：移除的 topic unsubscribe", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a", "t/b"], () => fake.client);
    src.connect();
    src.update(SCHEMA, ["t/a"]); // 去掉 t/b
    assert.deepEqual(fake.unsubs, ["t/b"]);
  });

  it("update：topic 集合不变 → 零订阅变化（不重连不重推 retain）", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a", "t/b"], () => fake.client);
    src.connect();
    const subCount = fake.subs.length;
    src.update(SCHEMA, ["t/b", "t/a"]); // 同集合（顺序无关）
    assert.equal(fake.subs.length, subCount, "无新增订阅");
    assert.deepEqual(fake.unsubs, [], "无取消订阅");
  });

  it("update 在 connect 前：只记期望，connect 时落实新集合", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a"], () => fake.client);
    src.update(SCHEMA, ["t/a", "t/c"]); // 未连接
    assert.equal(fake.subs.length, 0, "未连接不订阅");
    src.connect();
    assert.deepEqual(fake.subs.map((s) => s.topic), ["t/a", "t/c"], "connect 用更新后的集合");
  });
});
