import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { previewVariants } from "./preview";
import { ALL_CAPABILITIES } from "./capabilities";

const cap = (type: string) => {
  const c = ALL_CAPABILITIES.find((x) => x.type === type);
  if (!c) throw new Error(`无此 type: ${type}`);
  return c;
};
const nonFault = (type: string) => previewVariants(cap(type)).filter((v) => !v.state.fault);

describe("previewVariants", () => {
  it("数值类图元展示低/高两端（不再冻结单值）", () => {
    // tank 的 level、controlvalve 的 opening、bargauge 的 value 都应跨低高
    for (const [type, key] of [["tank", "level"], ["controlvalve", "opening"], ["bargauge", "value"]] as const) {
      const vals = nonFault(type).map((v) => v.state.values[key] as number);
      assert.ok(vals.length >= 2, `${type} 应至少两态`);
      assert.ok(Math.min(...vals) < 50 && Math.max(...vals) > 50, `${type} 应含低位和高位，实际 ${JSON.stringify(vals)}`);
    }
  });

  it("布尔类图元展示开/关两态", () => {
    const runs = nonFault("pump").map((v) => v.state.running);
    assert.deepEqual([...new Set(runs)].sort(), [false, true]);
    const opens = nonFault("valve").map((v) => v.state.values.open);
    assert.deepEqual([...new Set(opens)].sort(), [false, true]);
  });

  it("静态图元（无可绑状态）展示正常", () => {
    const v = nonFault("mixer");
    assert.equal(v.length, 1);
    assert.equal(v[0].label, "正常");
  });

  it("预览不含故障态（异常态统一在状态图例展示，不逐元件重复）", () => {
    for (const c of ALL_CAPABILITIES) {
      const v = previewVariants(c);
      assert.equal(v.filter((x) => x.state.fault).length, 0, `${c.type} 预览不应含故障态`);
    }
  });
});
