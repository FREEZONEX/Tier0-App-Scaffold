import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateMimicAssets } from "./validate-mimic";
import { createDefaultRegistry } from "./default-registry";
import { parseMimic } from "../schema/schema";

const registry = createDefaultRegistry();
const mk = (over: Record<string, unknown>) => parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "A", type: "tank", x: 0, y: 0, topics: [], bindings: {} },
    { id: "B", type: "valve", x: 1, y: 0, topics: [], bindings: {} },
  ],
  edges: [],
  ...over,
}).data!;

describe("validateMimicAssets", () => {
  it("全部合法 → 无警告", () => {
    assert.deepEqual(validateMimicAssets(mk({}), registry), []);
  });
  it("未知 type → 警告", () => {
    const m = parseMimic({ meta: { name: "x", version: 1 }, nodes: [{ id: "A", type: "pumps", x: 0, y: 0, topics: [], bindings: {} }], edges: [] }).data!;
    const w = validateMimicAssets(m, registry);
    assert.equal(w.length, 1);
    assert.match(w[0], /pumps/);
  });
  it("悬空连线 from/to → 警告", () => {
    const m = mk({ edges: [{ id: "e1", from: "A", to: "GHOST", points: [[0, 0], [1, 1]] }] });
    const w = validateMimicAssets(m, registry);
    assert.equal(w.length, 1);
    assert.match(w[0], /GHOST/);
  });
  it("未知 binding key → 警告（后配防拼错）", () => {
    // A 是 tank，只可绑 level/fault；绑 "opne" 应告警
    const m = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "A", type: "tank", x: 0, y: 0, topics: ["t"], bindings: { opne: { topic: "t", path: "v" } } }],
      edges: [],
    }).data!;
    const w = validateMimicAssets(m, registry);
    assert.ok(w.some((x) => /opne/.test(x)), `应告警未知键, got ${JSON.stringify(w)}`);
  });
  it("合法 binding key 不告警", () => {
    const m = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "A", type: "tank", x: 0, y: 0, topics: ["t"], bindings: { level: { topic: "t", path: "v" } } }],
      edges: [],
    }).data!;
    assert.deepEqual(validateMimicAssets(m, registry), []);
  });
  it("联锁引用缺失节点 → 警告", () => {
    const m = mk({ interlocks: [{ id: "il", when: { node: "A", field: "level", op: ">=", value: 90 }, then: [{ node: "NOPE", kind: "lock" }] }] });
    const w = validateMimicAssets(m, registry);
    assert.ok(w.some((x) => /NOPE/.test(x)));
  });
  it("联锁链存在环 → 警告", () => {
    const m = mk({
      interlocks: [
        { id: "r1", when: { node: "A", field: "f", op: "truthy", chainOn: true }, then: [{ node: "B", kind: "inhibit" }] },
        { id: "r2", when: { node: "B", field: "f", op: "truthy", chainOn: true }, then: [{ node: "A", kind: "inhibit" }] },
      ],
    });
    const w = validateMimicAssets(m, registry);
    assert.ok(w.some((x) => /环/.test(x)));
  });
  it("含 toPoint 的边（node→自由点）不产生悬空边警告", () => {
    // Task 3 在 validate-mimic.ts 加了豁免：只有 edge.to（节点 id）才检查是否存在；
    // toPoint 为自由点，不应触发「to 不是已知节点」告警。
    const m = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "A", type: "tank", x: 0, y: 0, topics: [], bindings: {} }],
      edges: [{ id: "e1", from: "A", toPoint: [200, 0], points: [[0, 0], [200, 0]] }],
    }).data!;
    const w = validateMimicAssets(m, registry);
    assert.deepEqual(w, [], `含 toPoint 的边不应产生告警，实际: ${JSON.stringify(w)}`);
  });
  it("含 fromPoint 的边（自由点→节点）不产生悬空边警告", () => {
    const m = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "B", type: "valve", x: 100, y: 0, topics: [], bindings: {} }],
      edges: [{ id: "e1", fromPoint: [0, 0], to: "B", points: [[0, 0], [100, 0]] }],
    }).data!;
    const w = validateMimicAssets(m, registry);
    assert.deepEqual(w, [], `含 fromPoint 的边不应产生告警，实际: ${JSON.stringify(w)}`);
  });
});
