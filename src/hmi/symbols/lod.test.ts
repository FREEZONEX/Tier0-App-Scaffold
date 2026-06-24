import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showDetail } from "./lod";

describe("LOD（已关闭：全细节）", () => {
  it("任何缩放都显示细节（showDetail 恒真）", () => {
    assert.equal(showDetail(1), true);
    assert.equal(showDetail(0.5), true);
    assert.equal(showDetail(0.1), true);
    assert.equal(showDetail(undefined), true);
  });
});
