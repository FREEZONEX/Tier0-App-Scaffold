import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTagStore } from "./tag-store";

describe("createTagStore", () => {
  it("存取最新 payload", () => {
    const store = createTagStore();
    store.setMessage("t/a", { v: 1 });
    assert.deepEqual(store.get("t/a"), { v: 1 });
  });

  it("setMessage 通知订阅者", () => {
    const store = createTagStore();
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.setMessage("t/a", 1);
    store.setMessage("t/a", 2);
    assert.equal(calls, 2);
  });

  it("getSnapshot 在两次 setMessage 之间引用稳定", () => {
    const store = createTagStore();
    const s1 = store.getSnapshot();
    const s2 = store.getSnapshot();
    assert.equal(s1, s2); // 同引用 → useSyncExternalStore 友好
    store.setMessage("t/a", 1);
    assert.notEqual(store.getSnapshot(), s1); // 更新后换新引用
  });

  it("退订后不再收到通知", () => {
    const store = createTagStore();
    let calls = 0;
    const off = store.subscribe(() => { calls += 1; });
    off();
    store.setMessage("t/a", 1);
    assert.equal(calls, 0);
  });
});
