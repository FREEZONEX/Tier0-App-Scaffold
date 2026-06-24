import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sceneBounds } from "./scene-bounds";
import { buildScene } from "./scene";
import { parseMimic } from "../schema/schema";
import { createRegistry, type SymbolDef } from "../symbols/registry";

const box20: SymbolDef = {
  type: "b",
  build: () => [],
  bounds: (node) => ({ x: node.x - 10, y: node.y - 10, w: 20, h: 20 }),
};
const rect40x20: SymbolDef = {
  type: "rect",
  build: () => [],
  bounds: (node) => ({ x: node.x - 20, y: node.y - 10, w: 40, h: 20 }),
};
const reg = createRegistry([box20, rect40x20]);
const scene = buildScene(parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "a", type: "b", x: 0, y: 0, topics: [], bindings: {} },
    { id: "c", type: "b", x: 100, y: 50, topics: [], bindings: {} },
  ],
  edges: [],
}).data!);

describe("sceneBounds", () => {
  it("求所有节点 bounds 的并集", () => {
    const box = sceneBounds(scene, reg);
    assert.equal(box.x, -10);
    assert.equal(box.y, -10);
    assert.equal(box.w, 120); // -10 .. 110
    assert.equal(box.h, 70); // -10 .. 60
  });
  it("空场景返回零盒", () => {
    const empty = buildScene(parseMimic({ meta: { name: "x", version: 1 }, nodes: [], edges: [] }).data!);
    assert.deepEqual(sceneBounds(empty, reg), { x: 0, y: 0, w: 0, h: 0 });
  });
  it("旋转 90° 的矩形节点包围盒交换宽高", () => {
    const s = buildScene(parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "r", type: "rect", x: 0, y: 0, rotation: 90, topics: [], bindings: {} }],
      edges: [],
    }).data!);
    const box = sceneBounds(s, reg);
    assert.ok(Math.abs(box.w - 20) < 0.01, `w≈20, got ${box.w}`);
    assert.ok(Math.abs(box.h - 40) < 0.01, `h≈40, got ${box.h}`);
  });
});
