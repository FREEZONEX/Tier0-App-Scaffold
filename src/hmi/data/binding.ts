import type { Binding } from "../schema/schema";

/**
 * 解析点/方括号路径（如 "a.b[0].c"）。任一环节缺失返回 undefined，不抛异常。
 */
export function resolvePath(source: unknown, path: string): unknown {
  const tokens = path.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = source;
  for (const token of tokens) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

/** 用 getPayload(topic) 取出 payload，再按 binding.path 解析出值。 */
export function resolveBinding(
  getPayload: (topic: string) => unknown,
  binding: Binding,
): unknown {
  return resolvePath(getPayload(binding.topic), binding.path);
}
