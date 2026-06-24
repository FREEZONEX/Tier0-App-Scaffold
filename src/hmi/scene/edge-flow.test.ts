import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEdgeFlow } from "./edge-flow";

const edge = { id: "e1", from: "a", to: "b", points: [[0, 0], [10, 0]] as [number, number][], flowBy: { topic: "t/f", path: "flow" } };

describe("resolveEdgeFlow", () => {
  it("flow > 0 → flowing true", () => {
    assert.equal(resolveEdgeFlow(edge, (t) => (t === "t/f" ? { flow: 5 } : undefined)), true);
  });
  it("flow = 0 → false", () => {
    assert.equal(resolveEdgeFlow(edge, () => ({ flow: 0 })), false);
  });
  it("无 flowBy → false", () => {
    assert.equal(resolveEdgeFlow({ ...edge, flowBy: undefined }, () => ({ flow: 5 })), false);
  });
  it("无数据 → false", () => {
    assert.equal(resolveEdgeFlow(edge, () => undefined), false);
  });
});
