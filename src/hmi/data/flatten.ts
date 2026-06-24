export interface PathValue {
  /** 点路径（与 resolveBinding 的 path 同语法；空串表示整条 payload）。 */
  readonly path: string;
  readonly value: unknown;
}

const MAX_DEPTH = 6;
const MAX_PATHS = 200;

/**
 * 把任意 payload 摊平成叶子路径列表（供"嗅探真实报文→点选 path"用）。
 * 对象/数组递归（数组用数字键，与 resolvePath 兼容）；标量为叶子。
 * 限制深度与条数，防超大/循环 payload 拖垮 UI。
 */
export function flattenPaths(value: unknown, prefix = "", out: PathValue[] = [], depth = 0): PathValue[] {
  if (out.length >= MAX_PATHS) return out;
  if (value !== null && typeof value === "object" && depth < MAX_DEPTH) {
    const entries: readonly (readonly [string, unknown])[] = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out.push({ path: prefix, value });
      return out;
    }
    for (const [k, v] of entries) {
      if (out.length >= MAX_PATHS) break;
      flattenPaths(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    }
    return out;
  }
  out.push({ path: prefix, value });
  return out;
}
