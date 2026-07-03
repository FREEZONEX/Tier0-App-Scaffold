import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitActions, truncateLabel, estimateTextWidth, contentBottomOf, layoutActionButtons, hitTestActionButtons, buildActionButtons, type ActionButtonBox } from "./action-buttons";
import { getPalette } from "../engine/theme";
import type { Primitive } from "../engine/primitives";
import type { MimicNode, DeviceAction } from "../schema/schema";

const theme = getPalette("light");
const mkNode = (n: number): MimicNode => ({
  id: "P1", type: "pump", x: 100, y: 100, rotation: 0, label: "P1", topics: [], bindings: {}, inline: [],
  actions: Array.from({ length: n }, (_, i) => ({ label: `动作${i + 1}`, items: [{ topic: "t", template: "{}" }] })) as DeviceAction[],
});
/** 内容底锚点（世界 y）：scene-render 用 contentBottomOf 算出后传入。 */
const ANCHOR = 124;

describe("splitActions", () => {
  it("≤3 全直达无溢出", () => {
    assert.deepEqual(splitActions(3), { direct: [0, 1, 2], overflow: [] });
    assert.deepEqual(splitActions(1), { direct: [0], overflow: [] });
  });
  it("≥4 前 2 直达其余溢出", () => {
    assert.deepEqual(splitActions(4), { direct: [0, 1], overflow: [2, 3] });
    assert.deepEqual(splitActions(8).overflow.length, 6);
  });
});

describe("truncateLabel / estimateTextWidth", () => {
  it("≤6 字原样，超长截断加 …", () => {
    assert.equal(truncateLabel("启动"), "启动");
    assert.equal(truncateLabel("一二三四五六七"), "一二三四五六…");
  });
  it("CJK 比西文宽", () => {
    assert.ok(estimateTextWidth("启动") > estimateTextWidth("GO"));
  });
});

describe("contentBottomOf", () => {
  const refBottom = 124;
  it("无下方文字 → 原样返回图形底（tank：位号在顶、值在罐内，均高于图形底）", () => {
    const prims: Primitive[] = [
      { kind: "text", x: 100, y: 60, text: "tank-1", style: { fill: "#000" } }, // 拱顶上方位号
      { kind: "text", x: 100, y: 100, text: "--", style: { fill: "#000" } }, // 罐内液位值
    ];
    assert.equal(contentBottomOf(prims, refBottom), refBottom);
  });
  it("有下方文字 → 取最低文字基线 + 下伸（位号+内联值时锚在内联值底）", () => {
    const prims: Primitive[] = [
      { kind: "text", x: 100, y: refBottom + 16, text: "P1", style: { fill: "#000" } },
      { kind: "text", x: 100, y: refBottom + 30, text: "12.3 rpm", style: { fill: "#000" } },
    ];
    assert.equal(contentBottomOf(prims, refBottom), refBottom + 30 + 3);
  });
  it("递归进 clip/rotate/scale 组合图元找文字", () => {
    const prims: Primitive[] = [
      {
        kind: "rotate", cx: 100, cy: 100, deg: 90,
        children: [{ kind: "text", x: 100, y: refBottom + 20, text: "T", style: { fill: "#000" } }],
      },
    ];
    assert.equal(contentBottomOf(prims, refBottom), refBottom + 20 + 3);
  });
  it("非文字图元不参与（图形本身低于 refBottom 也不改锚点——refBottom 已是图形底）", () => {
    const prims: Primitive[] = [{ kind: "rect", x: 90, y: 120, w: 20, h: 20, style: { fill: "#000" } }];
    assert.equal(contentBottomOf(prims, refBottom), refBottom);
  });
});

describe("layoutActionButtons", () => {
  it("3 个动作 → 3 个直达盒（无 overflow 盒），整行水平居中于 node.x", () => {
    const boxes = layoutActionButtons(mkNode(3), ANCHOR);
    assert.equal(boxes.length, 3);
    assert.ok(boxes.every((b) => b.action !== "overflow"));
    const left = boxes[0].x;
    const right = boxes[2].x + boxes[2].w;
    assert.ok(Math.abs((left + right) / 2 - 100) < 1, "按钮行中心≈node.x");
  });
  it("5 个动作 → 2 直达 + overflow 盒", () => {
    const boxes = layoutActionButtons(mkNode(5), ANCHOR);
    assert.equal(boxes.length, 3);
    assert.equal(boxes[2].action, "overflow");
  });
  it("y = 锚点 + (ROW_GAP+CONTAINER_PAD)×scale：容器框顶边到内容净距恒为 ROW_GAP", () => {
    const b = layoutActionButtons(mkNode(1), ANCHOR)[0];
    assert.equal(b.y, ANCHOR + 6 + 4); // ROW_GAP(6) + CONTAINER_PAD(4)
  });
  it("无动作 → 空数组", () => {
    assert.deepEqual(layoutActionButtons({ ...mkNode(1), actions: undefined }, ANCHOR), []);
  });
  it("sizeY 放大：锚点之下的偏移量等比放大（锚点本身由调用方按缩放算好）", () => {
    const gap1 = layoutActionButtons(mkNode(1), ANCHOR, 1)[0].y - ANCHOR;
    const gap2 = layoutActionButtons(mkNode(1), ANCHOR, 2)[0].y - ANCHOR;
    assert.ok(Math.abs(gap2 - gap1 * 2) < 0.01, `放大后偏移量应等比缩放，got gap1=${gap1} gap2=${gap2}`);
  });
  it("sizeY 缺省 = 1，行为与不传一致（向后兼容）", () => {
    const withDefault = layoutActionButtons(mkNode(1), ANCHOR)[0];
    const explicit1 = layoutActionButtons(mkNode(1), ANCHOR, 1)[0];
    assert.equal(withDefault.y, explicit1.y);
  });
  it("按钮尺寸跟节点等比缩放：scale=2 时按钮高度翻倍，不会显得比设备小", () => {
    const b1 = layoutActionButtons(mkNode(1), ANCHOR, 1)[0];
    const b2 = layoutActionButtons(mkNode(1), ANCHOR, 2)[0];
    assert.equal(b2.h, b1.h * 2);
    assert.equal(b2.w, b1.w * 2);
  });
  it("buildActionButtons：scale 传入时按钮圆角/描边/字号随之放大（视觉比例协调）", () => {
    const boxes = layoutActionButtons(mkNode(1), ANCHOR, 2);
    const prims1x = buildActionButtons(layoutActionButtons(mkNode(1), ANCHOR, 1), theme, () => "idle", 1);
    const prims2x = buildActionButtons(boxes, theme, () => "idle", 2);
    const r1 = prims1x.find((p) => p.kind === "rect" && p.r !== undefined && p.r < 12);
    const r2 = prims2x.find((p) => p.kind === "rect" && p.r !== undefined && p.r < 24);
    assert.ok(r1 && r2 && r1.kind === "rect" && r2.kind === "rect");
    if (r1?.kind === "rect" && r2?.kind === "rect") assert.equal(r2.r, (r1.r ?? 0) * 2, "按钮圆角应按 scale 等比放大");
    const text2x = prims2x.find((p) => p.kind === "text");
    const text1x = prims1x.find((p) => p.kind === "text");
    assert.ok(text1x?.kind === "text" && text2x?.kind === "text");
    if (text1x?.kind === "text" && text2x?.kind === "text") {
      const size1 = Number(/^(\d+)px/.exec(text1x.style.font ?? "")?.[1]);
      const size2 = Number(/^(\d+)px/.exec(text2x.style.font ?? "")?.[1]);
      assert.equal(size2, size1 * 2, "按钮字号应按 scale 等比放大");
    }
  });
});

describe("hitTestActionButtons", () => {
  it("命中盒内坐标返回该盒，盒外 null", () => {
    const boxes = layoutActionButtons(mkNode(2), ANCHOR);
    const b = boxes[1];
    assert.equal(hitTestActionButtons(boxes, b.x + 2, b.y + 2), b);
    assert.equal(hitTestActionButtons(boxes, 0, 0), null);
  });
  it("边界压线命中（闭区间）：左上角与右下角均算盒内", () => {
    const boxes = layoutActionButtons(mkNode(1), ANCHOR);
    const b = boxes[0];
    assert.equal(hitTestActionButtons(boxes, b.x, b.y), b);
    assert.equal(hitTestActionButtons(boxes, b.x + b.w, b.y + b.h), b);
  });
});

type RectPrim = Extract<Primitive, { kind: "rect" }>;
type LinePrim = Extract<Primitive, { kind: "line" }>;
type PolyPrim = Extract<Primitive, { kind: "polygon" }>;

/** 按钮胶囊 rect = 与某个命中盒几何完全一致的 rect（区别于归属容器框 rect）。 */
const btnRectsOf = (prims: readonly Primitive[], boxes: readonly ActionButtonBox[]): RectPrim[] =>
  prims.filter(
    (p): p is RectPrim => p.kind === "rect" && boxes.some((b) => b.x === p.x && b.y === p.y && b.w === p.w && b.h === p.h),
  );

describe("buildActionButtons", () => {
  it("每盒产出胶囊 rect + 文字；sent 态用 running 配色", () => {
    const boxes = layoutActionButtons(mkNode(2), ANCHOR);
    const prims = buildActionButtons(boxes, theme, (b) => (b.action === 0 ? "sent" : "idle"));
    const btnRects = btnRectsOf(prims, boxes);
    assert.equal(btnRects.length, 2);
    // 与 box[0]（action 0=sent）同几何的胶囊用 running 配色
    const sentRect = btnRects.find((r) => r.x === boxes[0].x);
    assert.ok(sentRect, "应有与 box[0] 同几何的胶囊");
    assert.equal(sentRect!.style.fill, theme.running);
    assert.ok(prims.some((p) => p.kind === "text"));
  });
  it("pressed 态用 fillDeep 深底", () => {
    const boxes = layoutActionButtons(mkNode(1), ANCHOR);
    const prims = buildActionButtons(boxes, theme, () => "pressed");
    const btnRects = btnRectsOf(prims, boxes);
    assert.equal(btnRects.length, 1, "应有按钮 rect");
    assert.equal(btnRects[0].style.fill, theme.fillDeep);
  });
});

describe("归属容器框 + 连接线（tether）", () => {
  // 容器框 = 用结构色 textMuted 描边的 rect（按钮胶囊描边是 theme.stroke，天然区分）。
  const containerOf = (prims: readonly Primitive[]): RectPrim | undefined =>
    prims.find((p): p is RectPrim => p.kind === "rect" && p.style.stroke === theme.textMuted);

  it("有按钮时输出一个包围容器框：结构色描边、含全部按钮、含极浅半透明衬底", () => {
    const boxes = layoutActionButtons(mkNode(2), ANCHOR);
    const prims = buildActionButtons(boxes, theme, () => "idle");
    const box = containerOf(prims);
    assert.ok(box, "应有归属容器框 rect");
    // 描边为结构色（textMuted），不是任何状态色
    assert.equal(box!.style.stroke, theme.textMuted);
    assert.ok(box!.style.stroke !== theme.alarm && box!.style.stroke !== theme.running && box!.style.stroke !== theme.selection && box!.style.stroke !== theme.interlock, "描边非状态色");
    // 半透明衬底
    assert.ok(box!.style.opacity !== undefined && box!.style.opacity! < 1, "衬底半透明");
    // 框完整包住所有按钮（含 padding）
    const left = Math.min(...boxes.map((b) => b.x));
    const right = Math.max(...boxes.map((b) => b.x + b.w));
    const top = Math.min(...boxes.map((b) => b.y));
    const bottom = Math.max(...boxes.map((b) => b.y + b.h));
    assert.ok(box!.x < left && box!.x + box!.w > right, "框左右包住按钮行");
    assert.ok(box!.y < top && box!.y + box!.h > bottom, "框上下包住按钮行");
  });
  it("不再输出连接线/箭头（用户反馈：箭头不好看，仅留容器框表达归属）", () => {
    const boxes = layoutActionButtons(mkNode(2), ANCHOR);
    const prims = buildActionButtons(boxes, theme, () => "idle");
    assert.equal(prims.find((p): p is LinePrim => p.kind === "line"), undefined, "不应有归属连接线");
    assert.equal(prims.find((p): p is PolyPrim => p.kind === "polygon"), undefined, "不应有归属三角箭头");
  });
  it("无按钮时不输出任何装饰（整体空）", () => {
    assert.deepEqual(buildActionButtons([], theme, () => "idle"), []);
  });
});
