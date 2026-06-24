import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";
import type { Palette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";
import { inlineLine } from "./inline";

/**
 * 图元下方标准两行：位号标签（belowY）+ 内联实时值（belowY+14）。
 * 多个图元复用，保证标签排版一致。
 */
export function labelAndInline(
  node: MimicNode,
  state: NodeState,
  theme: Palette,
  belowY: number,
): Primitive[] {
  const out: Primitive[] = [];
  if (node.label) {
    out.push({
      kind: "text",
      x: node.x,
      y: belowY,
      text: node.label,
      style: { fill: theme.textMuted, font: "10px ui-sans-serif, system-ui", textAlign: "center", halo: theme.canvas },
    });
  }
  const inline = inlineLine(node, state);
  if (inline) {
    out.push({
      kind: "text",
      x: node.x,
      y: belowY + 14,
      text: inline,
      style: { fill: theme.text, font: "600 11px ui-sans-serif, system-ui", textAlign: "center", halo: theme.canvas },
    });
  }
  return out;
}
