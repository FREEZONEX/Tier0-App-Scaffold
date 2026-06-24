// 连精馏塔(column)的仪表虚线：原图连到塔身**任意位置**（各塔板高度），按规则应是**独立自由线**
// （两端自由点，非元件连接点）→ 否则连塔节点必收束到塔边中点。本脚本把它们改成两端自由点：
//   仪表端 = 当前渲染端口（贴着气泡），塔端 = 塔壁上「该仪表自身高度」的点（沿壁分布）。
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
if (!parsed.data) { console.error("parse 失败", parsed.error); process.exit(1); }
const scene = buildScene(parsed.data);
const reg = createDefaultRegistry();
const r = renderScene(scene, reg, () => ({ values: {}, running: false, fault: false, stale: false }), () => false, getPalette("light"));
const pathById = new Map(r.edgePaths.map((p) => [p.id, p.points] as const));

const isColumn = (id: unknown) => typeof id === "string" && scene.byId[id]?.type === "column";

let changed = 0;
const edges = raw.edges.map((e: Record<string, unknown>) => {
  if (e.lead !== true) return e;
  const fromCol = isColumn(e.from), toCol = isColumn(e.to);
  if (!fromCol && !toCol) return e;                 // 不连塔，跳过
  if (e.fromPoint || e.toPoint) return e;           // 已是自由点
  const colId = (fromCol ? e.from : e.to) as string;
  const instrId = (fromCol ? e.to : e.from) as string;
  const colNode = scene.byId[colId], instrNode = scene.byId[instrId];
  const pts = pathById.get(e.id as string);
  if (!colNode || !instrNode || !pts || pts.length < 2) { console.log(`  ${e.id}: 跳过`); return e; }
  const colDef = reg.get("column");
  const box = colDef.coreBox ? colDef.coreBox(colNode) : { x: colNode.x, y: colNode.y, w: 0, h: 0 };
  // 塔壁朝向仪表的一侧；自由点 y = 仪表自身高度 → 各线水平、沿壁分布。
  const wallX = instrNode.x < colNode.x ? box.x : box.x + box.w;
  const colPoint: [number, number] = [wallX, instrNode.y];
  // 仪表端口 = 当前渲染端点（贴气泡边）。from=仪表时取 points[1]，否则 points[len-2]。
  const instrPort = fromCol ? pts[pts.length - 2] : pts[1];
  const instrPoint: [number, number] = [instrPort[0], instrPort[1]];
  const fromPoint = fromCol ? colPoint : instrPoint;
  const toPoint = fromCol ? instrPoint : colPoint;
  console.log(`  ${e.id}: ${instrId}→塔  自由线 from=${JSON.stringify(fromPoint)} to=${JSON.stringify(toPoint)}`);
  changed++;
  return { id: e.id, lead: true, fromPoint, toPoint, points: [fromPoint, toPoint] };
});

console.log(`\n改 ${changed} 条塔仪表虚线为独立自由线。`);
if (WRITE) {
  fs.writeFileSync(PATH, JSON.stringify({ ...raw, edges }, null, 2) + "\n");
  console.log(`已写回 ${PATH}`);
} else console.log("dry-run（--write 落盘）");
