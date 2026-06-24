import type { Mimic } from "@/hmi/schema/schema";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface DataMessage {
  readonly topic: string;
  readonly payload: unknown;
}

/** 真实 mqtt 与 mock 仿真共用此接口，页面可无缝切换。 */
export interface DataSource {
  connect(): void;
  disconnect(): void;
  onMessage(callback: (message: DataMessage) => void): () => void;
  onStatus(callback: (status: ConnectionStatus, error?: Error) => void): () => void;
  /** 发布一条消息（控制/操作下发）。mqtt 真发，mock 回显。 */
  publish(topic: string, payload: unknown): void;
  /**
   * 配置变更后增量更新，连接保持不断。
   * tier0：按 topic 差量 subscribe/unsubscribe —— 仅真正新增的 topic 触发 retain 补推，
   *   已订阅 topic 原封不动，整体连接不重建（避免无谓重连重推旧 retain 造成读数跳变）。
   * mock：热替换仿真 specs（计时器不重启，序列不复位）。
   */
  update(schema: Mimic, topics: readonly string[]): void;
  readonly status: ConnectionStatus;
}
