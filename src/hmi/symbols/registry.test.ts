import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRegistry, type SymbolDef } from "./registry";
import type { Primitive } from "../engine/primitives";
import { getPalette } from "../engine/theme";

const PALETTE_STUB = getPalette("light");

const dummy: SymbolDef = {
  type: "dummy",
  build: () => [{ kind: "circle", cx: 0, cy: 0, r: 1, style: { fill: "#000" } } as Primitive],
  bounds: (node) => ({ x: node.x - 10, y: node.y - 10, w: 20, h: 20 }),
};

describe("registry", () => {
  it("注册后可取回", () => {
    const reg = createRegistry([dummy]);
    assert.equal(reg.get("dummy"), dummy);
  });
  it("未知 type 返回 fallback 而非 undefined", () => {
    const reg = createRegistry([dummy]);
    const def = reg.get("nonexistent");
    assert.ok(def);
    assert.equal(def.type, "unknown");
  });
  it("fallback 的 build 产出占位图元（不抛）", () => {
    const reg = createRegistry([dummy]);
    const node = { id: "x", type: "nonexistent", x: 5, y: 5, rotation: 0, topics: [], bindings: {}, inline: [] };
    const prims = reg.get(node.type).build({ node, state: { values: {}, running: false, fault: false, stale: false }, theme: PALETTE_STUB });
    assert.ok(Array.isArray(prims) && prims.length > 0);
  });
  it("未知 type 只告警一次（不逐帧刷屏）", () => {
    const reg = createRegistry([dummy]);
    const orig = console.warn;
    let warns = 0;
    console.warn = () => { warns += 1; };
    try {
      reg.get("ghost");
      reg.get("ghost");
      reg.get("ghost");
    } finally {
      console.warn = orig;
    }
    assert.equal(warns, 1);
  });
});
