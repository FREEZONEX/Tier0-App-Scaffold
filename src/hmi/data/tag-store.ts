export interface TagSnapshot {
  /** 取某 topic 当前 payload，无则 undefined。 */
  get(topic: string): unknown;
}

export interface TagStore {
  setMessage(topic: string, payload: unknown): void;
  get(topic: string): unknown;
  subscribe(listener: () => void): () => void;
  /** 返回不可变快照，引用仅在 setMessage 后变化（useSyncExternalStore 友好）。 */
  getSnapshot(): TagSnapshot;
}

export function createTagStore(): TagStore {
  let payloads: Record<string, unknown> = {};
  const listeners = new Set<() => void>();

  const build = (source: Record<string, unknown>): TagSnapshot => ({
    get: (topic) => source[topic],
  });
  let snapshot: TagSnapshot = build(payloads);

  return {
    setMessage(topic, payload) {
      payloads = { ...payloads, [topic]: payload }; // 不可变
      snapshot = build(payloads);
      listeners.forEach((listener) => listener());
    },
    get(topic) {
      return payloads[topic];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}
