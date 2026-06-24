import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sparklinePath } from "./sparkline";

describe("sparklinePath", () => {
  it("空序列 → 空串", () => {
    assert.equal(sparklinePath([], 100, 20), "");
  });
  it("两点 [0,10] 映射到上下两角（y 反转）", () => {
    assert.equal(sparklinePath([0, 10], 100, 20), "0,20 100,0");
  });
  it("常量序列 → 居中平线", () => {
    assert.equal(sparklinePath([5, 5, 5], 100, 20), "0,10 50,10 100,10");
  });
  it("点数决定 x 步距", () => {
    const pts = sparklinePath([0, 5, 10], 100, 10).split(" ");
    assert.equal(pts.length, 3);
    assert.equal(pts[1].split(",")[0], "50");
  });
});
