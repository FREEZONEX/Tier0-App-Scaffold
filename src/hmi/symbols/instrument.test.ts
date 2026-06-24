import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instrument } from "./instrument";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");

const mk = (over = {}) => ({ id: "X", type: "instrument", x: 100, y: 100, rotation: 0, label: "X", topics: [], bindings: {}, inline: [], ...over });
const build = (
  values = {},
  st: { node?: object } & Partial<{ running: boolean; fault: boolean; stale: boolean }> = {},
  scale?: number,
) =>
  instrument.build({ node: mk(st.node), state: { values, running: false, fault: false, stale: false, ...st }, theme, scale });

const tagText = (prims: ReturnType<typeof build>): string | undefined => {
  // 圆心位号是第一条 text（labelAndInline 的标签在其后）
  const t = prims.find((p) => p.kind === "text");
  return t && t.kind === "text" ? t.text : undefined;
};

describe("instrument symbol", () => {
  it("默认（无 display props）渲染 DCS 方框：无圆、有 rect", () => {
    const prims = build();
    assert.ok(prims.length > 0);
    assert.ok(!prims.some((p) => p.kind === "circle"), "默认不画圆");
    assert.ok(prims.some((p) => p.kind === "rect"), "默认画 DCS 方框");
  });

  it("display=bubble 渲染 ISA 圆气泡：有圆、无 rect", () => {
    const prims = build({}, { node: { props: { display: "bubble" } } });
    assert.ok(prims.some((p) => p.kind === "circle"), "bubble 模式有圆");
    assert.ok(!prims.some((p) => p.kind === "rect"), "bubble 模式无方框");
  });

  it("display=box 渲染 DCS 方框（与默认相同）：无圆、有 rect", () => {
    const prims = build({}, { node: { props: { display: "box" } } });
    assert.ok(!prims.some((p) => p.kind === "circle"), "box 不画圆");
    assert.ok(prims.some((p) => p.kind === "rect"), "box 有方框");
  });

  it("bubble 模式：圆心写 props.tag", () => {
    assert.equal(tagText(build({}, { node: { props: { display: "bubble", tag: "FT" } } })), "FT");
    assert.equal(tagText(build({}, { node: { props: { display: "bubble", tag: "LT" } } })), "LT");
  });

  it("bubble 模式：缺 tag 时回落 props.face，再缺回落 \"I\"", () => {
    assert.equal(tagText(build({}, { node: { props: { display: "bubble", face: "P" } } })), "P");
    assert.equal(tagText(build({}, { node: { props: { display: "bubble" } } })), "I");
    assert.equal(tagText(build({}, { node: { props: { display: "bubble", tag: "  " } } })), "I");
  });

  it("bubble 不画任何水平分隔线（仪表只有圆+位号）", () => {
    assert.equal(build({}, { node: { props: { display: "bubble", tag: "FT" } } }).filter((p) => p.kind === "line").length, 0);
  });

  it("默认/display=box：DCS 数据框含完整位号(id)+值+中文名", () => {
    const prims = instrument.build({
      node: mk({ id: "PI-035A", label: "塔顶压力", props: { display: "box" } }),
      state: { values: { value: 78.1 }, units: { value: "kPa" }, running: false, fault: false, stale: false },
      theme,
    });
    assert.ok(!prims.some((p) => p.kind === "circle"), "box 模式不画圆");
    assert.ok(prims.some((p) => p.kind === "rect"), "box 模式有矩形框");
    const texts = prims.flatMap((p) => (p.kind === "text" ? [p.text] : []));
    assert.ok(texts.includes("PI-035A"), `应显示完整位号 id, got ${JSON.stringify(texts)}`);
    assert.ok(texts.some((t) => /78\.1/.test(t)), `应显示数值, got ${JSON.stringify(texts)}`);
    assert.ok(texts.includes("塔顶压力"), "应显示中文名");
  });

  it("circular 按 node 判定：默认/box 模式非圆形、bubble 为圆形", () => {
    assert.equal(typeof instrument.circular, "function");
    if (typeof instrument.circular === "function") {
      assert.equal(instrument.circular(mk({ props: { display: "box" } })), false);
      assert.equal(instrument.circular(mk({})), false, "默认（无 display）也应为非圆形");
      assert.equal(instrument.circular(mk({ props: { display: "bubble" } })), true, "bubble 才是圆形");
    }
  });

  it("bubble 模式：本体描边用 theme.stroke，圆填充用 fillLight", () => {
    const circle = build({}, { node: { props: { display: "bubble" } } }).find((p) => p.kind === "circle");
    assert.ok(circle && circle.kind === "circle");
    if (circle && circle.kind === "circle") {
      assert.equal(circle.style.stroke, theme.stroke);
      assert.equal(circle.style.fill, theme.fillLight);
    }
  });

  // —— 造型/线宽规范特征断言 ——

  it("bubble 线宽规范：外圈 strokeWidth=2", () => {
    const circle = build({}, { node: { props: { display: "bubble" } } }).find((p) => p.kind === "circle");
    assert.ok(circle && circle.kind === "circle");
    if (circle && circle.kind === "circle") {
      assert.equal(circle.style.strokeWidth, 2);
    }
  });
});
