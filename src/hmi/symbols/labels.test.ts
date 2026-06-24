import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { labelAndInline } from "./labels";
import { getPalette } from "../engine/theme";
import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";

const theme = getPalette("light");
const node = (label: string | undefined, inline: string[]): MimicNode => ({
  id: "X", type: "pump", x: 10, y: 20, rotation: 0, label, topics: [], bindings: {}, inline,
});
const st = (values: Record<string, unknown>): NodeState => ({ values, running: false, fault: false, stale: false });

describe("labelAndInline", () => {
  it("有 label 出标签文本", () => {
    const p = labelAndInline(node("P-01", []), st({}), theme, 50);
    assert.ok(p.some((x) => x.kind === "text" && x.text === "P-01"));
  });
  it("无 label 不出标签", () => {
    assert.equal(labelAndInline(node(undefined, []), st({}), theme, 50).length, 0);
  });
  it("有 inline 出值行", () => {
    const p = labelAndInline(node("P", ["rpm"]), st({ rpm: 1480 }), theme, 50);
    assert.ok(p.some((x) => x.kind === "text" && /1480/.test((x as { text: string }).text)));
  });
  // 标签/值行带画布底色 halo：管线从文字底下穿过时文字仍可读（衬底反白）
  it("标签与值行都带 canvas 底色 halo", () => {
    const p = labelAndInline(node("P-01", ["rpm"]), st({ rpm: 1480 }), theme, 50) as {
      kind: string;
      style: { halo?: string };
    }[];
    const texts = p.filter((x) => x.kind === "text");
    assert.equal(texts.length, 2);
    for (const t of texts) assert.equal(t.style.halo, theme.canvas);
  });
});
