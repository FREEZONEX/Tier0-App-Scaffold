import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMimic } from "../schema/schema";
import { buildScene, selectNode, resolveNodeState } from "./scene";

const mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    {
      id: "P-01",
      type: "pump",
      x: 0,
      y: 0,
      topics: ["t/p"],
      bindings: {
        running: { topic: "t/p", path: "status" },
      },
    },
  ],
  edges: [],
}).data!;

describe("buildScene", () => {
  it("建立 byId 索引且初始无选中", () => {
    const scene = buildScene(mimic);
    assert.equal(scene.byId["P-01"].type, "pump");
    assert.equal(scene.selectedId, null);
  });
});

describe("selectNode (不可变)", () => {
  it("返回新对象，原对象不变", () => {
    const scene = buildScene(mimic);
    const next = selectNode(scene, "P-01");
    assert.equal(next.selectedId, "P-01");
    assert.equal(scene.selectedId, null);
    assert.notEqual(scene, next);
  });
});

describe("resolveNodeState", () => {
  it("解析 running 布尔（接受字符串/数字）；fault 不再来自绑定", () => {
    const payloads: Record<string, unknown> = { "t/p": { status: "RUN" } };
    const state = resolveNodeState(mimic.nodes[0], (t) => payloads[t]);
    assert.equal(state.running, true);
    assert.equal(state.fault, false); // 无数值越限 → 不故障
    assert.equal(state.stale, false);
  });

  it("有 topics 但全无数据 → stale", () => {
    const state = resolveNodeState(mimic.nodes[0], () => undefined);
    assert.equal(state.stale, true);
  });

  it("阈值派生：高高报→alarm 且 fault；高报→warn", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "TK", type: "tank", x: 0, y: 0, topics: ["t/lv"], bindings: { level: { topic: "t/lv", path: "v", alarms: { hi: 90, hihi: 95 } } } }],
      edges: [],
    }).data!.nodes[0];
    const warn = resolveNodeState(n, () => ({ v: 92 }));
    assert.equal(warn.alarm, "warn");
    assert.equal(warn.fault, false);
    const alarm = resolveNodeState(n, () => ({ v: 97 }));
    assert.equal(alarm.alarm, "alarm");
    assert.equal(alarm.fault, true); // alarm 级并入 fault → 红环
    assert.equal(resolveNodeState(n, () => ({ v: 50 })).alarm, undefined);
  });

  it("map + scale：枚举映射与量程归一进 values", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "V", type: "valve", x: 0, y: 0, topics: ["t/v"], bindings: { open: { topic: "t/v", path: "st", map: { OPEN: true, CLOSED: false } } } }],
      edges: [],
    }).data!.nodes[0];
    assert.equal(resolveNodeState(n, () => ({ st: "OPEN" })).values.open, true);
    assert.equal(resolveNodeState(n, () => ({ st: "CLOSED" })).values.open, false);
  });

  it("map 未命中 → quality unknown（不算 stale）", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "V", type: "valve", x: 0, y: 0, topics: ["t/v"], bindings: { open: { topic: "t/v", path: "st", map: { "0": false, "1": true } } } }],
      edges: [],
    }).data!.nodes[0];
    const r = resolveNodeState(n, () => ({ st: 9 }));
    assert.equal(r.quality, "unknown");
    assert.equal(r.stale, false);
  });

  it("levels：记录各绑定字段的告警等级（面板定位告警源）", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{
        id: "TK", type: "tank", x: 0, y: 0, topics: ["t/lv"],
        bindings: {
          level: { topic: "t/lv", path: "v", alarms: { hi: 90 } },
          temp: { topic: "t/lv", path: "t", alarms: { hihi: 100 } },
        },
      }],
      edges: [],
    }).data!.nodes[0];
    const st = resolveNodeState(n, () => ({ v: 92, t: 120 }));
    assert.equal(st.levels?.level, "warn");
    assert.equal(st.levels?.temp, "alarm");
    const ok = resolveNodeState(n, () => ({ v: 50, t: 50 }));
    assert.equal(ok.levels?.level, undefined);
  });

  it("watch 配 alarms：越限参与节点告警（圈闪）并记录 watchLevels", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{
        id: "TK", type: "tank", x: 0, y: 0, topics: ["t/lv"],
        bindings: { level: { topic: "t/lv", path: "v" } },
        watches: [
          { label: "出口压力", topic: "t/lv", path: "p", alarms: { hihi: 8 } },
          { label: "无阈值", topic: "t/lv", path: "q" },
        ],
      }],
      edges: [],
    }).data!.nodes[0];
    const st = resolveNodeState(n, () => ({ v: 50, p: 9, q: 1 }));
    assert.equal(st.watchLevels?.[0], "alarm");
    assert.equal(st.watchLevels?.[1], undefined);
    assert.equal(st.alarm, "alarm"); // watch 越限并入节点告警 → 红圈
    assert.equal(st.fault, true);
    const ok = resolveNodeState(n, () => ({ v: 50, p: 3, q: 1 }));
    assert.equal(ok.alarm, undefined);
    assert.equal(ok.fault, false);
  });

  it("watchReadouts：解析各 watch 实时值+标签+告警级（供贴身渲染，如塔身多塔盘温度）", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{
        id: "T", type: "column", x: 0, y: 0, topics: ["t/x"], bindings: {},
        watches: [
          { label: "上部温度", topic: "t/x", path: "t1", unit: "°C" },
          { label: "塔釜温度", topic: "t/x", path: "t2", unit: "°C", alarms: { hihi: 150 } },
        ],
      }],
      edges: [],
    }).data!.nodes[0];
    const st = resolveNodeState(n, () => ({ t1: 144.1, t2: 151 }));
    assert.equal(st.watchReadouts?.length, 2);
    assert.deepEqual(st.watchReadouts?.[0], { label: "上部温度", value: 144.1, unit: "°C" });
    assert.equal(st.watchReadouts?.[1].value, 151);
    assert.equal(st.watchReadouts?.[1].unit, "°C"); // 单位透传供贴身显示
    assert.equal(st.watchReadouts?.[1].level, "alarm"); // 越限 → 贴身读数变色
  });

  it("无 watches 时不带 watchReadouts 字段", () => {
    const n = parseMimic({
      meta: { name: "x", version: 1 },
      nodes: [{ id: "P", type: "pump", x: 0, y: 0, topics: [], bindings: {} }],
      edges: [],
    }).data!.nodes[0];
    assert.equal(resolveNodeState(n, () => undefined).watchReadouts, undefined);
  });
});
