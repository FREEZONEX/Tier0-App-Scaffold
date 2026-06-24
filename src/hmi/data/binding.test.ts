import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePath, resolveBinding } from "./binding";

describe("resolvePath", () => {
  it("取嵌套字段", () => {
    assert.equal(resolvePath({ a: { b: 5 } }, "a.b"), 5);
  });
  it("取数组下标", () => {
    assert.equal(resolvePath({ a: [{ c: 9 }] }, "a[0].c"), 9);
  });
  it("路径不存在返回 undefined", () => {
    assert.equal(resolvePath({ a: 1 }, "a.b.c"), undefined);
  });
  it("源为 null 返回 undefined", () => {
    assert.equal(resolvePath(null, "a"), undefined);
  });
});

describe("resolveBinding", () => {
  it("用 topic 取 payload 再按 path 取值", () => {
    const payloads: Record<string, unknown> = { "t/x": { alarm: { active: true } } };
    const value = resolveBinding((topic) => payloads[topic], {
      topic: "t/x",
      path: "alarm.active",
    });
    assert.equal(value, true);
  });
  it("topic 无数据返回 undefined", () => {
    const value = resolveBinding(() => undefined, { topic: "t/missing", path: "a" });
    assert.equal(value, undefined);
  });
});
