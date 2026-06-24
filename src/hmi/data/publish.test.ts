import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publishMessages } from "./publish";

describe("publishMessages（操作下发：只发 broker，不做本地假显示）", () => {
  it("逐条调 source.publish，payload 经 parsePayload 解析", () => {
    const calls: { topic: string; payload: unknown }[] = [];
    const source = { publish: (topic: string, payload: unknown) => calls.push({ topic, payload }) };
    publishMessages(source, [
      { topic: "a/cmd", template: '{"cmd":"start"}' },
      { topic: "b/cmd", template: '{"v":1}' },
    ]);
    assert.deepEqual(calls, [
      { topic: "a/cmd", payload: { cmd: "start" } },
      { topic: "b/cmd", payload: { v: 1 } },
    ]);
  });

  it("非 JSON template 原样字符串发送", () => {
    const calls: { t: string; p: unknown }[] = [];
    const source = { publish: (t: string, p: unknown) => calls.push({ t, p }) };
    publishMessages(source, [{ topic: "x", template: "PLAIN" }]);
    assert.deepEqual(calls, [{ t: "x", p: "PLAIN" }]);
  });

  it("source 为 null/undefined 不崩、不抛", () => {
    assert.doesNotThrow(() => publishMessages(null, [{ topic: "x", template: "{}" }]));
    assert.doesNotThrow(() => publishMessages(undefined, [{ topic: "x", template: "{}" }]));
  });

  it("空 items 不调 publish", () => {
    let n = 0;
    publishMessages({ publish: () => { n++; } }, []);
    assert.equal(n, 0);
  });
});
