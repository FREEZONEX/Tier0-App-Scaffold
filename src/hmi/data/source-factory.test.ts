import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataSource, dataSourceKind } from "./source-factory";
import type { Tier0Config } from "./tier0-config";
import { parseMimic, type Mimic } from "@/hmi/schema/schema";

const base: Mimic = parseMimic({ meta: { name: "x" }, nodes: [{ id: "P-1", type: "pump", x: 0, y: 0 }] }).data!;
const CFG: Tier0Config = { mqttHost: "wss://broker", mqttPort: "8084", apiKey: "sk-a-ws1_k" };

describe("source-factory", () => {
  it("无 Tier0 配置（null）→ mock 兜底源（有 tick）", () => {
    const src = createDataSource(base, ["t/a"], null);
    assert.ok("tick" in src, "mock 源应有 tick");
  });
  it("有 Tier0 配置（mqttHost 非空）→ tier0 源（无 tick）", () => {
    const src = createDataSource(base, ["t/a"], CFG);
    assert.ok(!("tick" in src), "tier0 源无 tick");
  });
  it("配置 mqttHost 空串 → 仍 mock 兜底", () => {
    const src = createDataSource(base, ["t/a"], { mqttHost: "", mqttPort: "8084", apiKey: "" });
    assert.ok("tick" in src, "host 空时应 mock");
  });
});

describe("dataSourceKind（UI 徽标三态）", () => {
  it("空图回落演示 → demo（优先级最高，盖过 broker）", () => {
    assert.equal(dataSourceKind(true, CFG), "demo");
    assert.equal(dataSourceKind(true, null), "demo");
  });
  it("非演示 + 有 broker → real", () => {
    assert.equal(dataSourceKind(false, CFG), "real");
  });
  it("非演示 + 无 broker → mock", () => {
    assert.equal(dataSourceKind(false, null), "mock");
  });
});
