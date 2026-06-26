import { createServerFn } from "@tanstack/react-start";

/** Tier0 MQTT 连接配置（服务端读、传给客户端连 broker 用）。值均为可序列化 string。 */
export interface Tier0Config {
  mqttHost: string;
  mqttPort: string;
  apiKey: string;
}

// 读 env：部署平台把**无前缀** TIER0_* 注入 process.env（与获取 topic 的 server fn 同源，见 uns-api.ts）。
const env = (k: string): string | undefined => {
  const v = typeof process !== "undefined" ? process.env?.[k] : undefined;
  return v || undefined;
};
const apiHost = (): string | undefined => env("TIER0_API_HOST");
const apiKey = (): string | undefined => env("TIER0_API_KEY");

/** 从 info 响应的 `mqtt` 段取出第一个有值的候选字段（string/number 皆可），并归一为 string。 */
function pickStr(obj: unknown, keys: readonly string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/**
 * 从 `/openapi/v1/info` 响应提取 broker 主机。
 * 真实响应是信封 `{ code, msg, data }`，broker 在 `data.mqttBroker`（裸主机名，不带 scheme/端口/路径）。
 * info 不携带端口（浏览器走 wss，端口沿用 env/默认 8084，见 tier0-source.ts）。
 * 取不到则回退 fallback（旧的 env 值），保证零退化。纯函数，便于测试。
 */
export function extractMqttConfig(
  info: unknown,
  fallback: Pick<Tier0Config, "mqttHost" | "mqttPort">,
): Pick<Tier0Config, "mqttHost" | "mqttPort"> {
  const data = (info as { data?: unknown } | null | undefined)?.data;
  const broker = pickStr(data, ["mqttBroker", "mqtt_broker", "broker", "host"]);
  // 容错：broker 多为裸 "host"，但也兼容 "host:port"。
  let host = broker;
  let port: string | undefined;
  if (broker) {
    const i = broker.lastIndexOf(":");
    if (i > 0 && /^\d+$/.test(broker.slice(i + 1))) {
      host = broker.slice(0, i);
      port = broker.slice(i + 1);
    }
  }
  return {
    mqttHost: host ?? fallback.mqttHost,
    mqttPort: port ?? fallback.mqttPort,
  };
}

/**
 * 服务端调 `/openapi/v1/info`（与获取 topic 的 server fn 同款：loadTier0OpenApi → configureClient → 调 api），
 * 从响应里取 MQTT broker host + 端口回传客户端直连 broker。apiKey 仍取自服务端注入的 env。
 *
 * info 不可用 / 未配 host → 回退 process.env.TIER0_MQTT_*（旧行为），保证零退化。
 * （MQTT 是浏览器直连 broker，apiKey 终究要到客户端；server fn 取不比 VITE_ 内联更不安全。）
 */
export const getTier0ConfigFn = createServerFn().handler(async (): Promise<Tier0Config> => {
  const fallback: Tier0Config = {
    mqttHost: env("TIER0_MQTT_HOST") ?? "",
    mqttPort: env("TIER0_MQTT_PORT") ?? "8084",
    apiKey: apiKey() ?? "",
  };
  if (!apiHost()) return fallback;
  try {
    const { loadTier0OpenApi } = await import("@/lib/tier0");
    const { configureClient, systemApi } = await loadTier0OpenApi();
    configureClient({ getApiHost: apiHost, getApiKey: apiKey });
    const info = await systemApi.openapiv1info({});
    return { ...extractMqttConfig(info, fallback), apiKey: fallback.apiKey };
  } catch (err) {
    console.error("[tier0-config] info fetch failed, falling back to env:", err);
    return fallback;
  }
});
