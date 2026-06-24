import type { ConnectionStatus, DataMessage, DataSource } from "./data-source";
import { mockSpecsFromSchema } from "./mock-spec";

export interface MockTopicSpec {
  readonly topic: string;
  /** 纯函数：步数 t → payload。例如 t => ({ level: 50 + 40 * Math.sin(t / 10) })。 */
  readonly shape: (t: number) => unknown;
}

export interface MockSource extends DataSource {
  /** 手动推进一步（测试用，绕开计时器）。 */
  tick(step: number): void;
}

export function createMockSource(
  specs: readonly MockTopicSpec[],
  intervalMs = 1000,
): MockSource {
  let status: ConnectionStatus = "disconnected";
  let currentSpecs: readonly MockTopicSpec[] = specs; // 可热替换：schema 变更时换 specs，计时器不重启
  const messageCallbacks = new Set<(message: DataMessage) => void>();
  const statusCallbacks = new Set<(status: ConnectionStatus, error?: Error) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let counter = 0;

  const setStatus = (next: ConnectionStatus, error?: Error) => {
    status = next;
    statusCallbacks.forEach((callback) => callback(next, error));
  };

  const tick = (step: number) => {
    for (const spec of currentSpecs) {
      const message: DataMessage = { topic: spec.topic, payload: spec.shape(step) };
      messageCallbacks.forEach((callback) => callback(message));
    }
  };

  return {
    get status() {
      return status;
    },
    connect() {
      if (timer) clearInterval(timer); // 防重复 connect 泄漏旧计时器
      counter = 0; // 重连从 t=0 起，仿真序列可复现
      setStatus("connecting");
      setStatus("connected");
      tick(counter); // 立即发首帧，避免加载初期短暂"失联"闪烁
      timer = setInterval(() => {
        counter += 1;
        tick(counter);
      }, intervalMs);
    },
    disconnect() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      setStatus("disconnected");
    },
    onMessage(callback) {
      messageCallbacks.add(callback);
      return () => {
        messageCallbacks.delete(callback);
      };
    },
    onStatus(callback) {
      statusCallbacks.add(callback);
      return () => {
        statusCallbacks.delete(callback);
      };
    },
    update(schema) {
      // schema 变更：从新图重算仿真 specs 并热替换。计时器与 counter 不动 → 仿真序列平滑续推，
      // 无重连、无 t=0 复位。topics 参数对 mock 无意义（mock 按 specs 产数，不订阅 broker）。
      currentSpecs = mockSpecsFromSchema(schema);
    },
    publish(topic: string, payload: unknown) {
      // mock 模式不连真 broker，回显便于开发时确认发了什么
      console.log("[mock publish]", topic, payload);
    },
    tick,
  };
}
