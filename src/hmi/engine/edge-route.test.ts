import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portsOf, nearestPort, centerRoute, autoRoute, sideRoute, nearestSide } from "./edge-route";

const box = { x: 0, y: 0, w: 40, h: 20 };

describe("edge-route 自动走线", () => {
  it("portsOf：四边中点（拖线交互锚点），左右口水平、上下口垂直", () => {
    const ports = portsOf(box);
    assert.equal(ports.length, 4);
    assert.deepEqual(ports[0], { x: 0, y: 10, h: true });
    assert.deepEqual(ports[1], { x: 40, y: 10, h: true });
    assert.deepEqual(ports[2], { x: 20, y: 0, h: false });
    assert.deepEqual(ports[3], { x: 20, y: 20, h: false });
  });

  it("portsOf：带锚点 cx/cy 时跨轴对齐到锚点（非 bbox 中心）—— 修非对称 bounds 接口偏移", () => {
    // bounds 非对称：左侧多 8（侧桩）、下方多 18（标签），锚点在视觉中心(20,10)
    const asym = { x: -8, y: 0, w: 48, h: 38, cx: 20, cy: 10 };
    const ports = portsOf(asym);
    // 左右口 Y 锚到 cy=10（非 bbox 中心 y=19）；上下口 X 锚到 cx=20（非 bbox 中心 x=16）
    assert.deepEqual(ports[0], { x: -8, y: 10, h: true });
    assert.deepEqual(ports[1], { x: 40, y: 10, h: true });
    assert.deepEqual(ports[2], { x: 20, y: 0, h: false });
    assert.deepEqual(ports[3], { x: 20, y: 38, h: false });
  });

  it("autoRoute：带锚点时走锚点-锚点（两端视觉中心齐平 → 直线）", () => {
    const A = { x: -8, y: 0, w: 48, h: 38, cx: 20, cy: 10 };
    const B = { x: 200, y: 6, w: 30, h: 28, cx: 215, cy: 10 };
    // 两端 cy 同为 10 → centerRoute 近共线退化直线（中段 y 恒为 10）
    const pts = autoRoute(A, B);
    assert.ok(pts.every((p) => p[1] === 10), `应为水平直线（y 恒 10），实得 ${JSON.stringify(pts)}`);
  });

  it("nearestPort：取离参考点最近的口", () => {
    assert.deepEqual(nearestPort(box, { x: 100, y: 10 }), { x: 40, y: 10, h: true });
    assert.deepEqual(nearestPort(box, { x: 20, y: -50 }), { x: 20, y: 0, h: false });
  });

  it("centerRoute：主轴优先正交 L 形（超出吸附带）", () => {
    // 水平为主 → 先横后竖
    assert.deepEqual(centerRoute({ x: 0, y: 0 }, { x: 100, y: 40 }), [[0, 0], [100, 0], [100, 40]]);
    // 垂直为主 → 先竖后横
    assert.deepEqual(centerRoute({ x: 0, y: 0 }, { x: 40, y: 100 }), [[0, 0], [0, 100], [40, 100]]);
  });

  it("centerRoute：近水平/垂直吸附成纯直线（消拐点）", () => {
    // 纵差 8 ≤ 阈值 → 收成水平线，终点纵坐标吸附到 a.y=0
    assert.deepEqual(centerRoute({ x: 0, y: 0 }, { x: 100, y: 8 }), [[0, 0], [100, 0]]);
    // 横差 5 ≤ 阈值 → 收成垂直线，终点横坐标吸附到 a.x=0
    assert.deepEqual(centerRoute({ x: 0, y: 0 }, { x: 5, y: 100 }), [[0, 0], [0, 100]]);
    // 纵差 40 > 阈值 → 不吸附，仍走 L
    assert.equal(centerRoute({ x: 0, y: 0 }, { x: 100, y: 40 }).length, 3);
  });

  it("autoRoute：中心到中心（端头藏进图元背板下，可见端贴紧轮廓零缝隙）", () => {
    const to = { x: 100, y: 0, w: 40, h: 20 };
    assert.deepEqual(autoRoute(box, to), [[20, 10], [120, 10]]);
  });

  it("autoRoute：移动目标后重算出不同轨迹（线随图元动的根基）", () => {
    const before = autoRoute(box, { x: 100, y: 0, w: 40, h: 20 });
    const after = autoRoute(box, { x: 100, y: 200, w: 40, h: 20 });
    assert.notDeepEqual(before, after);
    // 移到正下偏右 → 垂直为主，先竖后横
    assert.deepEqual(after, [[20, 10], [20, 210], [120, 210]]);
  });
});

describe("端口方位走线 sideRoute", () => {
  const A = { x: 0, y: 0, w: 40, h: 40 };
  const B = { x: 200, y: 0, w: 40, h: 40 };

  it("两端缺省 = 中心制（与 autoRoute 同）", () => {
    assert.deepEqual(sideRoute(A, B), autoRoute(A, B));
  });

  it("指定 fromSide=T：线从顶边中点出（固定点，最少折无 stub）", () => {
    const pts = sideRoute(A, B, "T");
    assert.deepEqual(pts[0], [20, 10]); // 内缩端点（顶边中点向内 10）
    assert.deepEqual(pts[1], [20, 0]); // 顶边中点（固定，不浮动）
    assert.deepEqual(pts[pts.length - 1], [220, 20]); // 末点到达 B 中心；全程正交
  });

  it("指定 toSide=B：线从目标底边中点入（固定点）", () => {
    const pts = sideRoute(A, B, undefined, "B");
    assert.deepEqual(pts[pts.length - 1], [220, 30]); // 内缩端点
    assert.deepEqual(pts[pts.length - 2], [220, 40]); // 底边中点（固定）
  });

  it("全程正交（相邻点同 x 或同 y）", () => {
    for (const [fs, ts] of [["T", "B"], ["L", "R"], ["R", "T"], ["B", "L"]] as const) {
      const pts = sideRoute(A, B, fs, ts);
      for (let i = 1; i < pts.length; i++) {
        assert.ok(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1], `${fs}->${ts} 第 ${i} 段斜线: ${JSON.stringify(pts)}`);
      }
    }
  });

  it("无相邻重复点", () => {
    const pts = sideRoute(A, B, "R", "L");
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i][0] !== pts[i - 1][0] || pts[i][1] !== pts[i - 1][1]);
    }
  });

  it("端口固定贴锚点 cy，绝不随两盒重叠被拉到 bbox 几何中心（修调节阀 L 口跑左上）", () => {
    // 调节阀类：执行器上凸使 bbox 上扩，几何中心 y=37.5 高于流心锚 cy=50；目标盒在 y 上重叠。
    const cv = { x: 85, y: 10, w: 30, h: 55, cx: 100, cy: 50 };
    const target = { x: 200, y: 30, w: 40, h: 40, cx: 220, cy: 60 };
    const pts = sideRoute(cv, target, "L", "R");
    // 出端口（pts[1]）必须落在流心 (85,50)，不被重叠中点/bbox 中心拉到上方。
    assert.deepEqual(pts[1], [85, 50], `L 口应贴流心 (85,50)，实得 ${JSON.stringify(pts)}`);
  });

  it("引线/实线一律固定端口：上下连接(B→T)端口贴各自 x 锚点，不随重叠浮动挪点", () => {
    // 铁律：从点拉出的线，端点钉死在边中点；线可折，但点不动（仅自由点边例外）。
    const a = { x: 90, y: 0, w: 20, h: 20, cx: 100, cy: 10 };
    const b = { x: 95, y: 100, w: 30, h: 30, cx: 110, cy: 115 };
    const pts = sideRoute(a, b, "B", "T");
    assert.deepEqual(pts[1], [100, 20], `出端口=a 底边中点(100,20)固定，实得 ${JSON.stringify(pts)}`);
    assert.deepEqual(pts[pts.length - 2], [110, 100], `入端口=b 顶边中点(110,100)固定，实得 ${JSON.stringify(pts)}`);
  });
});

// 连线铁律全覆盖：怎么折（单折 L / Z / 直线）+ 端点钉死 + 独立线两端自由。
describe("连线铁律：折法与端点钉死", () => {
  const A = { x: 0, y: 0, w: 40, h: 40 }; // L(0,20) R(40,20) T(20,0) B(20,40)

  it("单折 L：R→T 拐角 = [竖直端 x, 水平端 y]（用户给的折痕公式）", () => {
    const B = { x: 200, y: -100, w: 40, h: 40 }; // 右上，T 口 (220,-100)
    const pts = sideRoute(A, B, "R", "T");
    // 折痕 = R 口水平线(y=20) 与 T 口竖直线(x=220) 的交点 (220,20)
    assert.ok(pts.some((p) => p[0] === 220 && p[1] === 20), `应含拐角 (220,20)，实得 ${JSON.stringify(pts)}`);
  });

  it("单折 L：B→L 拐角 = [水平端 x, 竖直端 y]（对称验证）", () => {
    const B = { x: 200, y: 200, w: 40, h: 40 }; // 右下，L 口 (200,220)
    const pts = sideRoute(A, B, "B", "L");
    // B 口竖直线(x=20) 与 L 口水平线(y=220) 的交点 (20,220)
    assert.ok(pts.some((p) => p[0] === 20 && p[1] === 220), `应含拐角 (20,220)，实得 ${JSON.stringify(pts)}`);
  });

  it("Z 两折：R→L 不同高 → 中点 x 两折，端口各贴自身 cy", () => {
    const B = { x: 200, y: 60, w: 40, h: 40 }; // L 口 (200,80)
    const pts = sideRoute(A, B, "R", "L");
    assert.ok(pts.some((p) => p[0] === 120 && p[1] === 20), `应含折点 (120,20)，实得 ${JSON.stringify(pts)}`);
    assert.ok(pts.some((p) => p[0] === 120 && p[1] === 80), `应含折点 (120,80)，实得 ${JSON.stringify(pts)}`);
  });

  it("Z 两折：B→T 不同 x → 中点 y 两折", () => {
    const B = { x: 100, y: 200, w: 40, h: 40 }; // 下偏右，T 口 (120,200)
    const pts = sideRoute(A, B, "B", "T"); // a B 口 (20,40)
    assert.ok(pts.some((p) => p[0] === 20 && p[1] === 120), `应含折点 (20,120)，实得 ${JSON.stringify(pts)}`);
    assert.ok(pts.some((p) => p[0] === 120 && p[1] === 120), `应含折点 (120,120)，实得 ${JSON.stringify(pts)}`);
  });

  it("端口对齐 → 退化纯直线（无折）：R→L 同 cy 全程同 y", () => {
    const B = { x: 200, y: 0, w: 40, h: 40 }; // L 口 (200,20) 同 y
    const pts = sideRoute(A, B, "R", "L");
    assert.ok(pts.every((p) => p[1] === 20), `应水平直线 y=20，实得 ${JSON.stringify(pts)}`);
  });

  it("端点钉死铁律：移动对端，本端口坐标恒定", () => {
    const near = sideRoute(A, { x: 200, y: 0, w: 40, h: 40 }, "R", "L");
    const far = sideRoute(A, { x: 200, y: 300, w: 40, h: 40 }, "R", "L");
    assert.deepEqual(near[1], [40, 20], "近端：A 的 R 口 (40,20)");
    assert.deepEqual(far[1], [40, 20], "远端移动后：A 的 R 口仍 (40,20)，不挪");
  });

  it("独立线两端自由（无 side）→ 正交折线连两自由点（= autoRoute）", () => {
    const p1 = { x: 100, y: 100, w: 0, h: 0 }; // 库里拖出的独立线端 = 零尺寸自由点盒
    const p2 = { x: 300, y: 200, w: 0, h: 0 };
    const pts = sideRoute(p1, p2);
    assert.deepEqual(pts, autoRoute(p1, p2), "两端自由 = 中心制 autoRoute");
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1], "全程正交");
    }
  });
});

describe("nearestSide", () => {
  const box = { x: 0, y: 0, w: 40, h: 40 };
  it("四向判定", () => {
    assert.equal(nearestSide(box, { x: -5, y: 20 }), "L");
    assert.equal(nearestSide(box, { x: 45, y: 20 }), "R");
    assert.equal(nearestSide(box, { x: 20, y: -5 }), "T");
    assert.equal(nearestSide(box, { x: 20, y: 45 }), "B");
  });
});
