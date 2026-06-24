import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitTest, hitTestEdges, edgesInMarquee, nearestPointOnSegment, nearestPointOnPath, nearestEdgePoint } from "./hit-test";
import { createViewport } from "./viewport";

const boxes = [
  { id: "A", x: 0, y: 0, w: 20, h: 20 },
  { id: "B", x: 100, y: 100, w: 20, h: 20 },
];

describe("hitTest", () => {
  it("1:1 视口，点中 A 框内", () => {
    assert.equal(hitTest(boxes, createViewport(), 10, 10), "A");
  });
  it("点空白返回 null", () => {
    assert.equal(hitTest(boxes, createViewport(), 50, 50), null);
  });
  it("平移视口后命中随之偏移", () => {
    const vp = { scale: 1, x: 100, y: 100 };
    // 屏幕 (110,110) → 世界 (10,10) 命中 A
    assert.equal(hitTest(boxes, vp, 110, 110), "A");
  });
  it("后注册的框在重叠时优先（顶层）", () => {
    const overlap = [
      { id: "below", x: 0, y: 0, w: 50, h: 50 },
      { id: "above", x: 0, y: 0, w: 50, h: 50 },
    ];
    assert.equal(hitTest(overlap, createViewport(), 10, 10), "above");
  });
  it("圆形命中：圆心命中，bbox 角落落空", () => {
    const circ = [{ id: "C", x: 0, y: 0, w: 40, h: 40, circle: { cx: 20, cy: 20, r: 20 } }];
    assert.equal(hitTest(circ, createViewport(), 20, 20), "C"); // 圆心
    assert.equal(hitTest(circ, createViewport(), 2, 2), null); // bbox 左上角，圆外
  });
  it("旋转矩形：查询点反旋到局部系判定", () => {
    // 宽矩形 80×60，中心(40,10)，旋 90° → 视觉竖向
    const rot = [{ id: "R", x: 0, y: -20, w: 80, h: 60, rotation: 90 }];
    assert.equal(hitTest(rot, createViewport(), 40, 10), "R"); // 中心
    assert.equal(hitTest(rot, createViewport(), 40, 38), "R"); // 竖向延伸内
    assert.equal(hitTest(rot, createViewport(), 78, 10), null); // 原横向远端，旋后落空
  });
});

describe("hitTestEdges（连线命中）", () => {
  const vp = { scale: 1, x: 0, y: 0 };
  const paths = [
    { id: "e-1", points: [[0, 0], [100, 0], [100, 80]] as [number, number][] },
    { id: "e-2", points: [[0, 40], [100, 40]] as [number, number][] },
  ];
  it("线上点命中；容差内命中；远处不命中", () => {
    assert.equal(hitTestEdges(paths, vp, 50, 0), "e-1");
    assert.equal(hitTestEdges(paths, vp, 50, 5), "e-1"); // 默认容差 6px
    assert.equal(hitTestEdges(paths, vp, 50, 20), null);
  });
  it("重叠时后绘制优先", () => {
    assert.equal(hitTestEdges(paths, vp, 50, 40), "e-2");
  });
  it("容差按缩放换算（缩小一半时世界容差加倍）", () => {
    const out = { scale: 0.5, x: 0, y: 0 };
    // 屏幕 (25, 5)：世界 (50, 10)——世界距 e-1 为 10 > 6，但 6px/0.5=12 世界容差 → 命中
    assert.equal(hitTestEdges(paths, out, 25, 5), "e-1");
  });
  it("竖直段命中", () => {
    assert.equal(hitTestEdges(paths, vp, 102, 60), "e-1");
  });
});

describe("nearestPointOnSegment", () => {
  it("垂足在线段内部：垂直投影到 AB", () => {
    // 水平线段 (0,0)→(100,0)，点 (50,30)，最近点应为 (50,0)，距离 30
    const r = nearestPointOnSegment(0, 0, 100, 0, 50, 30);
    assert.ok(Math.abs(r.x - 50) < 1e-9);
    assert.ok(Math.abs(r.y - 0) < 1e-9);
    assert.ok(Math.abs(r.dist - 30) < 1e-9);
  });
  it("投影落在起点一侧：夹紧到起点", () => {
    // 水平线段 (10,0)→(100,0)，点 (-5,0)，最近点为起点 (10,0)，距离 15
    const r = nearestPointOnSegment(10, 0, 100, 0, -5, 0);
    assert.ok(Math.abs(r.x - 10) < 1e-9);
    assert.ok(Math.abs(r.y - 0) < 1e-9);
    assert.ok(Math.abs(r.dist - 15) < 1e-9);
  });
  it("投影落在终点一侧：夹紧到终点", () => {
    // 水平线段 (0,0)→(100,0)，点 (120,0)，最近点为终点 (100,0)，距离 20
    const r = nearestPointOnSegment(0, 0, 100, 0, 120, 0);
    assert.ok(Math.abs(r.x - 100) < 1e-9);
    assert.ok(Math.abs(r.y - 0) < 1e-9);
    assert.ok(Math.abs(r.dist - 20) < 1e-9);
  });
  it("退化线段（A==B）：返回端点距离", () => {
    const r = nearestPointOnSegment(5, 5, 5, 5, 8, 9);
    assert.ok(Math.abs(r.x - 5) < 1e-9);
    assert.ok(Math.abs(r.y - 5) < 1e-9);
    assert.ok(Math.abs(r.dist - 5) < 1e-9); // hypot(3,4)=5
  });
});

describe("nearestPointOnPath", () => {
  it("选取距离最近的线段上的投影点", () => {
    // 折线 (0,0)→(100,0)→(100,100)；查询点 (60,40)
    // 第一段最近点 (60,0) 距离 40；第二段最近点 (100,40) 距离 40 —— 相等取第一段
    const pts: [number, number][] = [[0, 0], [100, 0], [100, 100]];
    const r = nearestPointOnPath(pts, 60, 40);
    // 距离应为 40
    assert.ok(Math.abs(r.dist - 40) < 1e-9);
  });
  it("靠近折线末端竖段时正确返回竖段最近点", () => {
    // 折线 (0,0)→(100,0)→(100,100)；查询点 (80,80)
    // 第一段最近点 (80,0) 距离 80；第二段最近点 (100,80) 距离 20 → 应选竖段
    const pts: [number, number][] = [[0, 0], [100, 0], [100, 100]];
    const r = nearestPointOnPath(pts, 80, 80);
    assert.ok(Math.abs(r.point[0] - 100) < 1e-9);
    assert.ok(Math.abs(r.point[1] - 80) < 1e-9);
    assert.ok(Math.abs(r.dist - 20) < 1e-9);
  });
});

describe("nearestEdgePoint", () => {
  const paths = [
    { id: "e1", points: [[0, 0], [100, 0]] as [number, number][] },
    { id: "e2", points: [[0, 50], [100, 50]] as [number, number][] },
  ];
  it("返回最近边和该边的最近点", () => {
    // 查询点 (50, 10)：到 e1 距离 10；到 e2 距离 40 → 应返回 e1
    const r = nearestEdgePoint(paths, 50, 10, "none", 100);
    assert.ok(r !== null);
    assert.equal(r.edgeId, "e1");
    assert.ok(Math.abs(r.point[0] - 50) < 1e-9);
    assert.ok(Math.abs(r.point[1] - 0) < 1e-9);
    assert.ok(Math.abs(r.dist - 10) < 1e-9);
  });
  it("排除 excludeId 的边", () => {
    // 排除 e1，即使 e1 更近，也只能返回 e2
    const r = nearestEdgePoint(paths, 50, 10, "e1", 100);
    assert.ok(r !== null);
    assert.equal(r.edgeId, "e2");
  });
  it("超出 maxDist 时返回 null", () => {
    // 查询点 (50,10) 到 e1 距离 10，maxDist=5 → 无结果
    const r = nearestEdgePoint(paths, 50, 10, "none", 5);
    assert.equal(r, null);
  });
  it("单点折线（length<2）跳过", () => {
    const shortPaths = [{ id: "short", points: [[50, 25]] as [number, number][] }, ...paths];
    const r = nearestEdgePoint(shortPaths, 50, 10, "none", 100);
    assert.ok(r !== null);
    assert.notEqual(r.edgeId, "short");
  });
});

describe("edgesInMarquee（框选命中连线）", () => {
  const vp = createViewport(); // 1:1 视口
  // 横线 e-h: (0,0)→(100,0)；竖线 e-v: (50,50)→(50,150)；斜线 e-d: (0,100)→(100,200)
  const paths = [
    { id: "e-h", points: [[0, 0], [100, 0]] as [number, number][] },
    { id: "e-v", points: [[50, 50], [50, 150]] as [number, number][] },
    { id: "e-d", points: [[0, 100], [100, 200]] as [number, number][] },
  ];

  it("选框完全包含横线 → 命中", () => {
    const r = edgesInMarquee(paths, vp, -10, -10, 110, 10);
    assert.ok(r.includes("e-h"));
    assert.ok(!r.includes("e-v"));
    assert.ok(!r.includes("e-d"));
  });

  it("选框完全包含竖线 → 命中", () => {
    const r = edgesInMarquee(paths, vp, 40, 40, 60, 160);
    assert.ok(r.includes("e-v"));
    assert.ok(!r.includes("e-h"));
  });

  it("选框与横线段相交（仅端点在框内）→ 命中", () => {
    // 框 [80,80→120,−10]：只包含 e-h 右端点 (100,0)
    const r = edgesInMarquee(paths, vp, 80, -10, 120, 20);
    assert.ok(r.includes("e-h"), "端点在框内应命中");
  });

  it("选框与线段穿越相交（端点均在框外）→ 命中", () => {
    // e-d: (0,100)→(100,200)，框 [40,130]×[60,170]：两端点在框外，但线段穿过框
    const r = edgesInMarquee(paths, vp, 40, 130, 60, 170);
    assert.ok(r.includes("e-d"), "线段穿越框应命中");
    assert.ok(!r.includes("e-h"), "无关线段不应命中");
  });

  it("面积为0的选框落在线段上 → 端点命中", () => {
    // (50,50) 恰好是 e-v 的起点，退化框仍应命中
    const r = edgesInMarquee(paths, vp, 50, 50, 50, 50);
    assert.ok(r.includes("e-v"), "点选框命中端点所在的边");
  });

  it("选框与所有线段都不相交 → 返回空数组", () => {
    const r = edgesInMarquee(paths, vp, 200, 200, 300, 300);
    assert.equal(r.length, 0);
  });

  it("缩放视口：框选坐标按视口换算到世界系", () => {
    // scale=2, offset=(0,0)：屏幕坐标 ÷2 = 世界坐标；屏幕 [0,0]→[200,0+20] → 世界 [0,0]→[100,10] → 命中 e-h
    const scaledVp = { scale: 2, x: 0, y: 0 };
    const r = edgesInMarquee(paths, scaledVp, 0, -20, 200, 20);
    assert.ok(r.includes("e-h"));
  });
});
