import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readout } from "./readout";
import { getPalette } from "../engine/theme";
import type { NodeState } from "../scene/scene";

const theme = getPalette("light");
const node = { id: "RD", type: "readout", x: 100, y: 100, rotation: 0, label: "塔顶温度", topics: [], bindings: {}, inline: [] };

function build(state: Partial<NodeState> = {}) {
  return readout.build({ node, state: { values: {}, running: false, fault: false, stale: false, ...state }, theme });
}

describe("readout symbol", () => {
  it("浅底圆角盒 + 居中数值文本", () => {
    const prims = build({ values: { value: 144.12 }, units: { value: "°C" } });
    const box = prims.find((p) => p.kind === "rect") as { r?: number; style: { fill?: string } } | undefined;
    assert.ok(box, "应有盒");
    assert.equal(box!.style.fill, theme.fillLight);
    const txt = prims.find((p) => p.kind === "text") as { text: string; x: number } | undefined;
    assert.equal(txt?.text, "144.1 °C"); // 1 位小数 + 单位
    assert.equal(txt?.x, node.x); // 居中
  });

  it("无数据显示占位 --", () => {
    const txt = build().find((p) => p.kind === "text") as { text: string } | undefined;
    assert.equal(txt?.text, "--");
  });

  it("越限：数值变色（alarm 红 / warn 琥珀）", () => {
    const al = build({ values: { value: 99 }, levels: { value: "alarm" } }).find((p) => p.kind === "text") as { style: { fill?: string } };
    assert.equal(al.style.fill, theme.alarm);
    const wa = build({ values: { value: 88 }, levels: { value: "warn" } }).find((p) => p.kind === "text") as { style: { fill?: string } };
    assert.equal(wa.style.fill, theme.interlock);
  });

  it("盒宽随文字长度自适应（长值更宽）", () => {
    const short = build({ values: { value: 5 } }).find((p) => p.kind === "rect") as { w: number };
    const long = build({ values: { value: 123456.7 }, units: { value: "kPa" } }).find((p) => p.kind === "rect") as { w: number };
    assert.ok(long.w > short.w);
  });
});
