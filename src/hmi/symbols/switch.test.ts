import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { switchSymbol, bladeAngleDeg } from "./switch";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "SW-01", type: "switch", x: 100, y: 100, rotation: 0, label: "SW-01", topics: [], bindings: {}, inline: [] };

// 用 opening 数值建图元；legacy 用旧布尔 closed 建（兼容路径）。
function buildOpening(opening: unknown, scale?: number) {
  return switchSymbol.build({ node, state: { values: { opening }, running: false, fault: false, stale: false }, theme, scale });
}
function buildLegacy(values: Record<string, unknown>) {
  return switchSymbol.build({ node, state: { values, running: false, fault: false, stale: false }, theme });
}

/** 可动刀片：第一条 line（端子引线在细节层之后 push）。 */
function blade(prims: ReturnType<typeof buildOpening>) {
  return prims.find((p) => p.kind === "line") as { x1: number; y1: number; x2: number; y2: number; style: { stroke?: string } };
}
const lift = (l: { y1: number; y2: number }) => l.y1 - l.y2; // 自由端高于铰接点的抬高

describe("switch symbol", () => {
  it("bladeAngleDeg：开合度→刀片抬角线性（100=0°平直、0=最大角、50=半角）", () => {
    assert.equal(bladeAngleDeg(100), 0);
    assert.equal(bladeAngleDeg(0), 55);
    assert.equal(bladeAngleDeg(50), 27.5);
    assert.equal(bladeAngleDeg(140), 0); // 越界夹紧
    assert.equal(bladeAngleDeg(-20), 55);
  });

  it("opening=100：刀片平直（y1==y2）触达右触点，绿（激活）", () => {
    const l = blade(buildOpening(100));
    assert.equal(l.y1, l.y2, "平直");
    assert.ok(Math.abs(l.x2 - (node.x + 18)) < 1e-6, "自由端落在右触点");
    assert.equal(l.style.stroke, theme.running, ">0 = 绿");
  });

  it("opening=0：刀片抬至最大角（自由端高于铰接点），默认色 stroke", () => {
    const l = blade(buildOpening(0));
    assert.ok(lift(l) > 0, "断开态刀片自由端应抬起");
    assert.equal(l.style.stroke, theme.stroke, "0 = 默认色");
  });

  it("着色：opening=0 默认色、>0 绿（含半开）", () => {
    assert.equal(blade(buildOpening(0)).style.stroke, theme.stroke);
    assert.equal(blade(buildOpening(1)).style.stroke, theme.running, "刚过 0 即绿");
    assert.equal(blade(buildOpening(50)).style.stroke, theme.running, "半开也绿");
    assert.equal(blade(buildOpening(100)).style.stroke, theme.running);
  });

  it("角度随 opening 连续：半开抬高介于全开与全闭之间", () => {
    const open = lift(blade(buildOpening(0)));
    const half = lift(blade(buildOpening(50)));
    const closed = lift(blade(buildOpening(100)));
    assert.ok(closed === 0 && half > 0 && half < open, `连续抬角 0<${half}<${open}`);
  });

  it("兼容旧布尔绑定：closed=true→视为闭合(平直绿)、false→断开(抬角)", () => {
    const on = blade(buildLegacy({ closed: true }));
    const off = blade(buildLegacy({ closed: false }));
    assert.equal(on.y1, on.y2, "closed:true 平直");
    assert.equal(on.style.stroke, theme.running);
    assert.ok(lift(off) > 0, "closed:false 抬角");
  });

  it("含两个固定触点小圆（左右分居锚点）", () => {
    const circles = buildOpening(100).filter((p) => p.kind === "circle");
    assert.equal(circles.length, 2);
    const xs = circles.map((c) => (c as { cx: number }).cx).sort((a, b) => a - b);
    assert.ok(xs[0] < node.x && xs[1] > node.x, "两触点应分居锚点左右");
  });

  it("细节层含端子引线（≥2 条向外短 line）", () => {
    const lines = buildOpening(100).filter((p) => p.kind === "line");
    assert.ok(lines.length >= 3, `应有刀片+端子引线共≥3条 line，实得 ${lines.length}`);
  });

});
