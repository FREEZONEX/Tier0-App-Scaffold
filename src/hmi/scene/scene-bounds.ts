import type { Scene } from "./scene";
import type { Registry } from "../symbols/registry";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 绕盒中心旋转 deg 度后的轴对齐包围盒。deg=0/缺省时原样返回。 */
function rotatedBox(b: Box, deg?: number): Box {
  if (!deg) return b;
  const a = (deg * Math.PI) / 180;
  const hw = b.w / 2;
  const hh = b.h / 2;
  const ew = Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a));
  const eh = Math.abs(hw * Math.sin(a)) + Math.abs(hh * Math.cos(a));
  const cx = b.x + hw;
  const cy = b.y + hh;
  return { x: cx - ew, y: cy - eh, w: 2 * ew, h: 2 * eh };
}

/** 所有节点 bounds 的并集，用于 viewport.fit。空场景返回零盒。 */
export function sceneBounds(scene: Scene, registry: Registry): Box {
  if (scene.nodes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of scene.nodes) {
    const b = registry.get(node.type).bounds(node);
    const r = rotatedBox(b, node.rotation);
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
