import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateInterlockRefs } from "./refs";
import { parseMimic } from "../schema/schema";

const mk = (interlocks: unknown[]) => parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "TK", type: "tank", x: 0, y: 0, topics: [], bindings: {} },
    { id: "FV", type: "valve", x: 1, y: 0, topics: [], bindings: {} },
  ],
  edges: [],
  interlocks,
}).data!;

describe("validateInterlockRefs", () => {
  it("全部引用存在 → 无警告", () => {
    const m = mk([{ id: "il", when: { node: "TK", field: "level", op: ">=", value: 90 }, then: [{ node: "FV", kind: "forceClose" }] }]);
    assert.deepEqual(validateInterlockRefs(m), []);
  });
  it("when 引用缺失节点 → 报警", () => {
    const m = mk([{ id: "il", when: { node: "GHOST", field: "level", op: ">=", value: 90 }, then: [{ node: "FV", kind: "forceClose" }] }]);
    const w = validateInterlockRefs(m);
    assert.equal(w.length, 1);
    assert.match(w[0], /GHOST/);
  });
  it("then 引用缺失节点 → 报警", () => {
    const m = mk([{ id: "il", when: { node: "TK", field: "level", op: ">=", value: 90 }, then: [{ node: "NOPE", kind: "trip" }] }]);
    const w = validateInterlockRefs(m);
    assert.equal(w.length, 1);
    assert.match(w[0], /NOPE/);
  });
  it("when 数组逐条检查", () => {
    const m = mk([{ id: "il", when: [{ node: "TK", field: "a", op: "truthy" }, { node: "X", field: "b", op: "truthy" }], then: [{ node: "FV", kind: "lock" }] }]);
    assert.equal(validateInterlockRefs(m).length, 1);
  });
});
