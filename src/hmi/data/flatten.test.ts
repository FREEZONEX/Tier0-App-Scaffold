import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flattenPaths } from "./flatten";
import { resolvePath } from "./binding";

describe("flattenPaths", () => {
  it("嵌套对象摊平为点路径", () => {
    const r = flattenPaths({ a: 1, b: { c: 2, d: { e: 3 } } });
    assert.deepEqual(r, [
      { path: "a", value: 1 },
      { path: "b.c", value: 2 },
      { path: "b.d.e", value: 3 },
    ]);
  });
  it("数组用数字键，且与 resolvePath 兼容", () => {
    const obj = { arr: [{ v: 10 }, { v: 20 }] };
    const r = flattenPaths(obj);
    assert.deepEqual(r.map((p) => p.path), ["arr.0.v", "arr.1.v"]);
    // 摊平出的 path 能被 resolvePath 还原
    assert.equal(resolvePath(obj, r[1].path), 20);
  });
  it("标量 payload → path 为空串（整条）", () => {
    assert.deepEqual(flattenPaths(42), [{ path: "", value: 42 }]);
  });
  it("空对象作为叶子", () => {
    assert.deepEqual(flattenPaths({ a: {} }), [{ path: "a", value: {} }]);
  });
});
