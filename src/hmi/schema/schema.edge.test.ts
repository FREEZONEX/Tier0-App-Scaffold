import { test } from "node:test";
import assert from "node:assert/strict";
import { mimicSchema } from "./schema";

const base = { meta: { name: "t" }, nodes: [], interlocks: [] };
const parseEdge = (edge: unknown) => mimicSchema.safeParse({ ...base, edges: [edge] });

test("edge: 节点→节点 合法", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", to: "B", points: [[0,0],[1,1]] }).success, true);
});
test("edge: 节点→自由点 合法", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", toPoint: [10, 20], points: [[0,0],[1,1]] }).success, true);
});
test("edge: 自由点→自由点 合法", () => {
  assert.equal(parseEdge({ id: "e1", fromPoint: [0,0], toPoint: [10,20], points: [[0,0],[1,1]] }).success, true);
});
test("edge: 一端既给节点又给自由点 → 报错", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", fromPoint: [0,0], to: "B", points: [[0,0],[1,1]] }).success, false);
});
test("edge: 一端两者都不给 → 报错", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", points: [[0,0],[1,1]] }).success, false);
});
