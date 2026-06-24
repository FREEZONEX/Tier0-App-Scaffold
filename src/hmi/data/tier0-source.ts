import type { ConnectionStatus, DataMessage, DataSource } from "./data-source";
import { tier0MqCredentials } from "./tier0-credentials";
import type { Tier0Config } from "./tier0-config";

/**
 * 用服务端传来的 Tier0Config 建 Tier0MQClient，显式传 host/port/password/凭证。
 * 配置来自 server fn（`getTier0ConfigFn` 读无前缀 `process.env.TIER0_*`），不再读 `import.meta.env`：
 * 平台注入的是无 `VITE_` 前缀变量、客户端读不到，故走 server fn 取后传入。
 * username/clientId 由 API key 正确解析（绕开 SDK 的 3 段限制，见 tier0-credentials）。
 */
export async function makeTier0Client(config: Tier0Config): Promise<Tier0ClientLike> {
  const rand = Math.random().toString(36).slice(2, 10); // 仅 clientId 去重，非安全用途
  const creds = tier0MqCredentials(config.apiKey || undefined, rand);
  const mqConfig = {
    host: config.mqttHost || undefined,
    port: config.mqttPort ? Number(config.mqttPort) : undefined,
    password: config.apiKey || undefined,
    ...creds,
  };
  // 🔧 诊断：确认最终传给 broker 的配置——重点看 host/port 有无、apiKey 是否为空、
  // 凭证是否解析成功（apiKey 格式不符 → username 退化 → broker 鉴权被拒）。排查完删。
  console.log("[MQTT] 建连配置", {
    host: mqConfig.host ?? "(空)",
    port: mqConfig.port ?? "(空)",
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}…(len=${config.apiKey.length})` : "(空)",
    username: mqConfig.username ?? "(解析失败·无效)",
    clientId: mqConfig.clientId ?? "(无)",
    凭证解析: creds ? "成功" : "失败（apiKey 格式不符，username 将退化，broker 会拒）",
  });
  const { Tier0MQClient } = await import("@tier0/sdk/mq");
  return new Tier0MQClient(mqConfig) as unknown as Tier0ClientLike;
}

/** Tier0MQClient 的最小类型面（便于注入假实现测试）。 */
export interface Tier0ClientLike {
  subscribe(topic: string, handler: (topic: string, payload: string) => void): void;
  unsubscribe(topic: string, handler?: (topic: string, payload: string) => void): void;
  publish(topic: string, payload: unknown): Promise<void> | void;
  on(event: "connect" | "disconnect" | "error", cb: (...args: never[]) => void): void;
  disconnect(): void;
}

const decode = (payload: string): unknown => {
  try { return JSON.parse(payload); } catch { return payload; }
};

const isPromiseLike = <T,>(value: Promise<T> | T): value is Promise<T> =>
  typeof (value as Promise<T>).then === "function";

/** 包装 Tier0MQClient 为 DataSource。makeClient 由调用方提供（生产用 `() => makeTier0Client(config)`，测试注入假实现）。 */
export function createTier0Source(
  initialTopics: readonly string[],
  makeClient: () => Promise<Tier0ClientLike> | Tier0ClientLike,
): DataSource {
  let client: Tier0ClientLike | null = null;
  let status: ConnectionStatus = "disconnected";
  let connectVersion = 0;
  let wanted: string[] = [...initialTopics]; // 期望订阅集（未连接时也记着，connect 时落实）
  const subscribed = new Set<string>(); // 实际已在 broker 上订阅的 topic
  const msgCbs = new Set<(m: DataMessage) => void>();
  const statusCbs = new Set<(s: ConnectionStatus, e?: Error) => void>();
  const setStatus = (s: ConnectionStatus, e?: Error) => { status = s; statusCbs.forEach((c) => c(s, e)); };
  const handler = (topic: string, payload: string) => {
    const m: DataMessage = { topic, payload: decode(payload) };
    msgCbs.forEach((c) => c(m));
  };
  const sub = (t: string) => { client!.subscribe(t, handler); subscribed.add(t); };
  const unsub = (t: string) => { client!.unsubscribe(t, handler); subscribed.delete(t); };
  return {
    get status() { return status; },
    connect() {
      setStatus("connecting");
      const version = ++connectVersion;
      const attach = (nextClient: Tier0ClientLike) => {
        if (version !== connectVersion) {
          nextClient.disconnect();
          return;
        }
        client = nextClient;
        client.on("connect", () => {
          console.log("[MQTT] connected to broker");
          setStatus("connected");
        });
        client.on("disconnect", () => {
          console.log("[MQTT] connection closed by broker, auth, or handshake failure");
          setStatus("disconnected");
        });
        client.on("error", ((e: Error) => {
          console.error("[MQTT] connection error", e?.message ?? e, e);
          setStatus("error", e);
        }) as (...a: never[]) => void);
        wanted.forEach(sub);
      };
      try {
        const nextClient = makeClient();
        if (isPromiseLike(nextClient)) {
          void nextClient.then(attach).catch((err: unknown) => {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error("[MQTT] failed to create client", error);
            setStatus("error", error);
          });
        } else {
          attach(nextClient);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[MQTT] failed to create client", error);
        setStatus("error", error);
      }
    },
    // 差量订阅：仅对新增 topic subscribe（触发其 retain）、对移除 topic unsubscribe；已订阅的原封不动。
    // 未连接时只更新期望集，connect 时再落实。不重建连接 → 不重推已订阅 topic 的旧 retain。
    update(_schema, topics) {
      wanted = [...topics];
      if (!client) return;
      const next = new Set(topics);
      for (const t of next) if (!subscribed.has(t)) sub(t);
      for (const t of [...subscribed]) if (!next.has(t)) unsub(t);
    },
    disconnect() { connectVersion++; client?.disconnect(); client = null; subscribed.clear(); setStatus("disconnected"); },
    onMessage(cb) { msgCbs.add(cb); return () => { msgCbs.delete(cb); }; },
    onStatus(cb) { statusCbs.add(cb); return () => { statusCbs.delete(cb); }; },
    publish(topic, payload) { void client?.publish(topic, payload); },
  };
}
