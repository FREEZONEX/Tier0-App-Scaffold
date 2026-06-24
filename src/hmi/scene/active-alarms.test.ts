import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeAlarms } from "./active-alarms";
import type { NodeState } from "./scene";
import type { MimicNode } from "../schema/schema";

// 最小 NodeState 工厂：只填聚合要读的字段，其余给安全默认
const st = (p: Partial<NodeState>): NodeState => ({
  values: {}, fractions: {}, units: {}, running: false, fault: false, stale: false, ...p,
});

const node = (id: string, label?: string, watches?: { label: string; topic: string; path: string }[]): MimicNode =>
  ({ id, label, type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [], watches }) as unknown as MimicNode;

describe("activeAlarms", () => {
  it("无任何告警 → 空数组", () => {
    const nodes = [node("A"), node("B")];
    assert.deepEqual(activeAlarms(nodes, () => st({})), []);
  });

  it("收集绑定字段告警，带显示值；label 用 node.label 兜底 id", () => {
    const nodes = [node("TK-1", "原料罐")];
    const states: Record<string, NodeState> = {
      "TK-1": st({ values: { level: 95 }, levels: { level: "warn" } }),
    };
    const r = activeAlarms(nodes, (id) => states[id]);
    assert.deepEqual(r, [{ nodeId: "TK-1", label: "原料罐", field: "level", level: "warn", value: "95" }]);
  });

  it("alarm 排在 warn 前；同级按 label 再按 field 稳定排序", () => {
    const nodes = [node("P-2", "泵2"), node("R-1", "反应釜")];
    const states: Record<string, NodeState> = {
      "P-2": st({ values: { level: 30 }, levels: { level: "warn" } }),
      "R-1": st({ values: { level: 99, temp: 88 }, levels: { level: "alarm", temp: "warn" } }),
    };
    const r = activeAlarms(nodes, (id) => states[id]);
    // R-1.level(alarm) 最前；其余 warn 按 label("泵2"<"反应釜"? 按 localeCompare/code) 再 field
    assert.equal(r[0].level, "alarm");
    assert.equal(r[0].nodeId, "R-1");
    assert.equal(r[0].field, "level");
    assert.equal(r.filter((a) => a.level === "warn").length, 2); // P-2.level + R-1.temp
    assert.equal(r.length, 3);
  });

  it("watch 告警：field 取 watch.label，value 省略（NodeState 不带 watch 原始值）", () => {
    const nodes = [node("R-1", "反应釜", [{ label: "出口压力", topic: "t", path: "p" }, { label: "无阈值", topic: "t", path: "q" }])];
    const states: Record<string, NodeState> = {
      "R-1": st({ values: {}, watchLevels: ["alarm", undefined] }),
    };
    const r = activeAlarms(nodes, (id) => states[id]);
    assert.deepEqual(r, [{ nodeId: "R-1", label: "反应釜", field: "出口压力", level: "alarm" }]);
  });

  it("stale 节点不产告警（levels/watchLevels 为空）", () => {
    const nodes = [node("X")];
    assert.deepEqual(activeAlarms(nodes, () => st({ stale: true })), []);
  });
});
