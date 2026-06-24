import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockSpecsFromSchema } from "./mock-spec";
import { parseMimic } from "../schema/schema";

const mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "TK-01", type: "tank", x: 0, y: 0, topics: ["t/level"], bindings: { level: { topic: "t/level", path: "level" } } },
    { id: "P-01", type: "pump", x: 0, y: 0, topics: ["t/pump"], bindings: { running: { topic: "t/pump", path: "running" } } },
  ],
  edges: [{ id: "e", from: "TK-01", to: "P-01", points: [[0, 0], [1, 1]], flowBy: { topic: "t/flow", path: "flow" } }],
}).data!;

describe("mockSpecsFromSchema", () => {
  it("为每个唯一 topic 生成一个 spec（含 edge.flowBy 的 topic）", () => {
    const specs = mockSpecsFromSchema(mimic);
    const topics = specs.map((s) => s.topic).sort();
    assert.deepEqual(topics, ["t/flow", "t/level", "t/pump"]);
  });
  it("shape(t) 返回带绑定 path 字段的对象", () => {
    const specs = mockSpecsFromSchema(mimic);
    const level = specs.find((s) => s.topic === "t/level")!;
    const payload = level.shape(0) as Record<string, unknown>;
    assert.ok("level" in payload);
    assert.equal(typeof payload.level, "number");
  });
  it("布尔类绑定 path 产出布尔值", () => {
    const specs = mockSpecsFromSchema(mimic);
    const pump = specs.find((s) => s.topic === "t/pump")!;
    const payload = pump.shape(0) as Record<string, unknown>;
    assert.equal(typeof payload.running, "boolean");
  });
  it("不同 topic 的同名数值字段在同一时刻取值不同（跨 topic 相位错开，避免满屏同值）", () => {
    const m = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [
        { id: "A", type: "meter", x: 0, y: 0, topics: ["p/FIC019A"], bindings: { flow: { topic: "p/FIC019A", path: "v" } } },
        { id: "B", type: "meter", x: 0, y: 0, topics: ["p/FIC022A"], bindings: { flow: { topic: "p/FIC022A", path: "v" } } },
        { id: "C", type: "meter", x: 0, y: 0, topics: ["p/LIC014A"], bindings: { level: { topic: "p/LIC014A", path: "v" } } },
      ],
      edges: [],
    }).data!;
    const specs = mockSpecsFromSchema(m);
    const at = (topic: string) => (specs.find((s) => s.topic === topic)!.shape(0) as Record<string, number>).v;
    const vals = [at("p/FIC019A"), at("p/FIC022A"), at("p/LIC014A")];
    assert.equal(new Set(vals).size, 3, `三个单字段 topic 应取值各异，实得 ${JSON.stringify(vals)}`);
  });

  it("恶意 path 不污染 Object 原型（__proto__ 守卫）", () => {
    const evil = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "N", type: "tank", x: 0, y: 0, topics: ["t/x"], bindings: { a: { topic: "t/x", path: "__proto__.polluted" } } }],
      edges: [],
    }).data!;
    const spec = mockSpecsFromSchema(evil).find((s) => s.topic === "t/x")!;
    spec.shape(0);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal((Object.prototype as Record<string, unknown>).polluted, undefined);
  });
});
