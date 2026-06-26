import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractMqttConfig } from "./tier0-config";

const FALLBACK = { mqttHost: "fallback.host", mqttPort: "8084" };

describe("extractMqttConfig", () => {
  it("从信封 data.mqttBroker 取裸主机名，端口沿用兜底", () => {
    const info = { code: 0, msg: "ok", data: { mqttBroker: "broker.example.com" } };
    assert.deepEqual(extractMqttConfig(info, FALLBACK), {
      mqttHost: "broker.example.com",
      mqttPort: "8084",
    });
  });

  it("broker 形如 host:port 时拆出端口", () => {
    const info = { data: { mqttBroker: "broker.example.com:9001" } };
    assert.deepEqual(extractMqttConfig(info, FALLBACK), {
      mqttHost: "broker.example.com",
      mqttPort: "9001",
    });
  });

  it("data 段缺失 → 回退 env", () => {
    assert.deepEqual(extractMqttConfig({ code: 0, msg: "x" }, FALLBACK), FALLBACK);
  });

  it("null / 非对象 info → 回退 env", () => {
    assert.deepEqual(extractMqttConfig(null, FALLBACK), FALLBACK);
    assert.deepEqual(extractMqttConfig("nope", FALLBACK), FALLBACK);
  });

  it("mqttBroker 空白 → 回退 env", () => {
    assert.deepEqual(extractMqttConfig({ data: { mqttBroker: "   " } }, FALLBACK), FALLBACK);
  });

  it("兼容 mqtt_broker / broker 备用字段名", () => {
    assert.deepEqual(extractMqttConfig({ data: { broker: "b.host" } }, FALLBACK), {
      mqttHost: "b.host",
      mqttPort: "8084",
    });
  });
});
