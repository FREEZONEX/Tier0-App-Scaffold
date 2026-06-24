import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMimic } from "../schema/schema";
import defaultMimic from "./default-mimic.json";

// 默认 seed 的是空白图（模板开局空画布）。客户图不走文件/seed：
// 由 scripts/load-mimic.mts 直接 UPSERT 进 DB 的 default 行（见 services/mimics.ts）。
describe("默认工艺图", () => {
  it("default-mimic 是合法空白图（开局空画布）", () => {
    const r = parseMimic(defaultMimic);
    assert.ok(r.ok, r.error);
    assert.equal(r.data!.nodes.length, 0, "default 必须无节点");
    assert.equal(r.data!.edges.length, 0);
    assert.equal(r.data!.interlocks.length, 0);
  });
});
