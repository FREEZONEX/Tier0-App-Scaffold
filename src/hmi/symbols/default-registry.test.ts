import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultRegistry } from "./default-registry";

describe("createDefaultRegistry", () => {
  it("注册全部内置图元", () => {
    const reg = createDefaultRegistry();
    for (const t of ["tank", "pump", "valve", "meter", "motor", "fan", "filter", "damper", "switch", "bargauge", "dialgauge", "exchanger", "vessel", "condenser", "cooler", "column", "drum", "silo", "compressor", "heater", "controlvalve", "checkvalve", "safetyvalve", "instrument", "cyclone", "mixer", "agitator"]) {
      assert.equal(reg.get(t).type, t);
    }
  });
  it("未知 type 回落 fallback", () => {
    assert.equal(createDefaultRegistry().get("nope").type, "unknown");
  });
});
