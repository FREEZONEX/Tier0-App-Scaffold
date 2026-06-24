// 一次性迁移：用真实 renderScene 推断每条无 side 引线的当前渲染连接边，写回 demo-mimic.json。
// 端口落在元件边中点：L/R 口 y=node.y、T/B 口 x=node.x → 由端点相对节点中心反推 side，零视觉变化。
import fs from "node:fs";
import { buildScene } from "../src/hmi/scene/scene";
import { parseMimic } from "../src/hmi/schema/schema";
import { renderScene } from "../src/hmi/symbols/scene-render";
import { createDefaultRegistry } from "../src/hmi/symbols/default-registry";
import { getPalette } from "../src/hmi/engine/theme";

const PATH = "src/hmi/data/demo-mimic.json";
const WRITE = process.argv.includes("--write");

const raw = JSON.parse(fs.readFileSync(PATH, "utf8"));
const parsed = parseMimic(raw);
if (!parsed.data) {
  console.error("parse 失败", parsed.error);
  process.exit(1);
}
const scene = buildScene(parsed.data);
const reg = createDefaultRegistry();
const theme = getPalette("light");
const idle = () => ({ values: {}, running: false, fault: false, stale: false });
const r = renderScene(scene, reg, idle, () => false, theme);

const pathById = new Map(r.edgePaths.map((p) => [p.id, p.points] as const));

function inferSide(port: readonly [number, number], node: { x: number; y: number }): "L" | "R" | "T" | "B" {
  const dx = port[0] - node.x;
  const dy = port[1] - node.y;
  // 口落在边中点：水平口(L/R) dy≈0、竖直口(T/B) dx≈0 → 取主轴定方位。
  if (Math.abs(dy) <= Math.abs(dx)) return dx < 0 ? "L" : "R";
  return dy < 0 ? "T" : "B";
}

let changed = 0;
const out = raw.edges.map((e: Record<string, unknown>) => {
  const isLead = e.lead === true;
  const free = e.fromPoint !== undefined || e.toPoint !== undefined;
  const needs = isLead && !free && (e.fromSide === undefined || e.toSide === undefined) && e.from && e.to;
  if (!needs) return e;
  const pts = pathById.get(e.id as string);
  const fromNode = scene.byId[e.from as string];
  const toNode = scene.byId[e.to as string];
  if (!pts || pts.length < 2 || !fromNode || !toNode) {
    console.log(`  ${e.id}: 跳过(无路径/节点)`);
    return e;
  }
  const fs = inferSide(pts[1], fromNode);
  const ts = inferSide(pts[pts.length - 2], toNode);
  console.log(`  ${e.id}: ${e.from}→${e.to}  fromSide=${fs} toSide=${ts}`);
  changed++;
  return { ...e, fromSide: fs, toSide: ts };
});

console.log(`\n推断 ${changed} 条引线的 side。`);
if (WRITE) {
  fs.writeFileSync(PATH, JSON.stringify({ ...raw, edges: out }, null, 2) + "\n");
  console.log(`已写回 ${PATH}`);
} else {
  console.log("dry-run（加 --write 才落盘）");
}
