import { createServerFn } from "@tanstack/react-start";

/** Tier0 MQTT 连接配置（服务端读、传给客户端连 broker 用）。值均为可序列化 string。 */
export interface Tier0Config {
  mqttHost: string;
  mqttPort: string;
  apiKey: string;
}

/**
 * 服务端读平台注入的**无前缀** `process.env.TIER0_*`，返回给客户端连 MQTT broker 用。
 *
 * 为何走 server fn 而非 `import.meta.env.VITE_*`：平台注入的是无 `VITE_` 前缀变量，
 * 而 Vite 只把 `VITE_` 前缀的变量内联进客户端 bundle → 客户端读不到无前缀变量。
 * server fn 跑在 Node 服务端，`process.env` 有平台注入的全部变量，取出后回传客户端。
 * （MQTT 是浏览器直连 broker，apiKey 终究要到客户端；server fn 取不比 VITE_ 内联更不安全。）
 */
export const getTier0ConfigFn = createServerFn().handler(async (): Promise<Tier0Config> => ({
  mqttHost: process.env.TIER0_MQTT_HOST ?? "",
  mqttPort: process.env.TIER0_MQTT_PORT ?? "8084",
  apiKey: process.env.TIER0_API_KEY ?? "",
}));
