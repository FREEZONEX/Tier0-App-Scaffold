import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMimic } from "./schema";

const valid = {
  meta: { name: "1#车间", version: 1 },
  broker: { url: "ws://broker.local:9001" },
  nodes: [
    {
      id: "P-01",
      type: "pump",
      x: 240,
      y: 110,
      label: "P-01 离心泵",
      topics: ["t/telemetry"],
      bindings: { running: { topic: "t/telemetry", path: "status" } },
      inline: ["running"],
    },
  ],
  edges: [
    { id: "e1", from: "TK-01", to: "P-01", points: [[110, 110], [150, 110]] },
  ],
};

describe("parseMimic", () => {
  it("接受合法 schema 并填默认值", () => {
    const result = parseMimic(valid);
    assert.equal(result.ok, true);
    assert.equal(result.data?.nodes[0].rotation, 0); // default
    assert.equal(result.data?.edges[0].flowBy, undefined);
  });

  it("缺 meta.name 时返回字段级错误", () => {
    const bad = { ...valid, meta: { version: 1 } };
    const result = parseMimic(bad);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /meta\.name/);
  });

  it("edge.points 少于 2 个点被拒", () => {
    const bad = { ...valid, edges: [{ id: "e1", from: "a", to: "b", points: [[1, 1]] }] };
    const result = parseMimic(bad);
    assert.equal(result.ok, false);
  });

  it("interlocks 默认空数组（向后兼容）", () => {
    const r = parseMimic(valid);
    assert.deepEqual(r.data?.interlocks, []);
  });
  it("接受合法 interlock 规则并填默认（combine=all, onStale=lock, kind=lock）", () => {
    const r = parseMimic({
      ...valid,
      interlocks: [{ id: "il1", when: { node: "TK-01", field: "level", op: ">=", value: 90 }, then: [{ node: "HV-01" }] }],
    });
    assert.equal(r.ok, true);
    assert.equal(r.data?.interlocks[0].combine, "all");
    assert.equal(r.data?.interlocks[0].onStale, "lock");
    assert.equal(r.data?.interlocks[0].then[0].kind, "lock");
  });
  it("比较算子缺 value 被拒", () => {
    const r = parseMimic({
      ...valid,
      interlocks: [{ id: "il1", when: { node: "A", field: "x", op: ">" }, then: [{ node: "B" }] }],
    });
    assert.equal(r.ok, false);
  });
  it("无 value 的算子（fault/truthy）合法", () => {
    const r = parseMimic({
      ...valid,
      interlocks: [{ id: "il1", when: { node: "A", field: "fault", op: "fault" }, then: [{ node: "B", kind: "trip" }] }],
    });
    assert.equal(r.ok, true);
  });

  it("节点 id 重复被拒（byId 会静默覆盖）", () => {
    const dup = {
      ...valid,
      nodes: [valid.nodes[0], { ...valid.nodes[0], x: 1, y: 1 }],
    };
    const r = parseMimic(dup);
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /重复/);
  });

  it("超过节点数上限被拒（fail-fast）", () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({ id: `N${i}`, type: "tank", x: 0, y: 0 }));
    const r = parseMimic({ ...valid, nodes: many });
    assert.equal(r.ok, false);
  });

  describe("publishPresets 归一（旧单条 → {name, items}）", () => {
    const withPreset = (preset: unknown) => ({
      ...valid,
      nodes: [{ ...valid.nodes[0], publishPresets: [preset] }],
    });
    it("旧形态 {topic, template} → name 回落 topic、单条 items", () => {
      const r = parseMimic(withPreset({ topic: "cmd/p1", template: '{"run":true}' }));
      assert.equal(r.ok, true);
      assert.deepEqual(r.data?.nodes[0].publishPresets, [
        { name: "cmd/p1", items: [{ topic: "cmd/p1", template: '{"run":true}' }] },
      ]);
    });
    it("旧形态带 name → 保留 name", () => {
      const r = parseMimic(withPreset({ name: "启泵", topic: "cmd/p1", template: "{}" }));
      assert.equal(r.data?.nodes[0].publishPresets?.[0].name, "启泵");
    });
    it("新形态 {name, items} 原样通过（多条消息）", () => {
      const preset = { name: "联动", items: [{ topic: "a", template: "{}" }, { topic: "b", template: "{}" }] };
      const r = parseMimic(withPreset(preset));
      assert.equal(r.ok, true);
      assert.equal(r.data?.nodes[0].publishPresets?.[0].items.length, 2);
    });
    it("空对象（无名无消息）被拒", () => {
      const r = parseMimic(withPreset({}));
      assert.equal(r.ok, false);
    });
  });
});

describe("actions 设备动作", () => {
  const node = (actions: unknown) => ({
    meta: { name: "m" },
    nodes: [{ id: "p1", type: "pump", x: 0, y: 0, actions }],
  });

  it("合法动作列表通过（label+items+confirm）", () => {
    const r = parseMimic(node([
      { label: "启动", items: [{ topic: "cmd/run", template: '{"run":1}' }], confirm: true },
      { label: "停止", items: [{ topic: "cmd/run", template: '{"run":0}' }] },
    ]));
    assert.ok(r.ok, r.error);
    assert.equal(r.data!.nodes[0].actions?.length, 2);
    assert.equal(r.data!.nodes[0].actions?.[0].confirm, true);
  });

  it("空 label / 空 items 拒绝", () => {
    assert.equal(parseMimic(node([{ label: "", items: [{ topic: "t", template: "{}" }] }])).ok, false);
    assert.equal(parseMimic(node([{ label: "启动", items: [] }])).ok, false);
  });

  it("恰好 8 个动作通过，超过 8 个拒绝", () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `a${i}`, items: [{ topic: "t", template: "{}" }] }));
    assert.ok(parseMimic(node(mk(8))).ok);
    assert.equal(parseMimic(node(mk(9))).ok, false);
  });

  it("未配置 actions 的节点不受影响；带旧 control 字段的数据被剥离不报错", () => {
    const r = parseMimic({ meta: { name: "m" }, nodes: [{ id: "p", type: "pump", x: 0, y: 0, control: { press: {} } }] });
    assert.ok(r.ok);
    assert.equal(r.data!.nodes[0].actions, undefined);
    assert.equal((r.data!.nodes[0] as Record<string, unknown>).control, undefined);
  });
});
