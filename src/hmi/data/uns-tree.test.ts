import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleRows } from "./uns-tree";
import type { UnsTopic } from "./uns-normalize";

const t = (path: string, hasChildren = true): UnsTopic => ({ path, name: path, hasChildren });

describe("visibleRows（UNS 树可见行扁平化）", () => {
  it("按展开态深度优先扁平化，depth 递增", () => {
    const childrenOf = { "": [t("a"), t("b", false)], a: [t("a/x", false)] };
    const rows = visibleRows(childrenOf, new Set(["a"]));
    assert.deepEqual(rows.map((r) => [r.node.path, r.depth]), [["a", 0], ["a/x", 1], ["b", 0]]);
  });

  it("未展开的分支不下钻", () => {
    const childrenOf = { "": [t("a")], a: [t("a/x", false)] };
    assert.deepEqual(visibleRows(childrenOf, new Set()).map((r) => r.node.path), ["a"]);
  });

  // 爆栈回归：子列表含自身（旧 API 形状 childrenOf["v1"]=[v1]）必须终止而非无限递归
  it("自包含环（节点出现在自己的子列表）终止不爆栈", () => {
    const childrenOf = { "": [t("v1")], v1: [t("v1")] };
    const rows = visibleRows(childrenOf, new Set(["v1"]));
    assert.ok(rows.length <= 2); // 有限行
  });

  it("祖先环（a→b→a）终止不爆栈", () => {
    const childrenOf = { "": [t("a")], a: [t("b")], b: [t("a")] };
    const rows = visibleRows(childrenOf, new Set(["a", "b"]));
    assert.ok(rows.length <= 3);
  });
});
