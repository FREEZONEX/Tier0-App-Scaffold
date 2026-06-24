/**
 * 记住从 UNS 选过的 topic 的字段（schema），供：
 *  1. 绑定「字段来源」下拉在实时报文未到时直接列出可绑字段（否则只能干等报文 / 手输）。
 *  2. 选定动作 topic 后按 schema 自动生成示例 payload JSON 回填（用户反馈 3）。
 * 模块级缓存、非持久（刷新即清，靠重选或实时报文恢复）。
 */

/** 缓存的字段（保留 type 以便生成带类型默认值的示例 payload）。 */
export interface UnsField {
  readonly name: string;
  readonly type?: string;
}

const fieldsByTopic = new Map<string, readonly UnsField[]>();

export function rememberUnsTopicFields(topic: string, fields: readonly UnsField[]): void {
  if (topic && fields.length) {
    fieldsByTopic.set(
      topic,
      fields.map((f) => ({ name: f.name, type: f.type })),
    );
  }
}

/** 取回字段名（供「字段来源」下拉）。 */
export function unsTopicFields(topic: string): readonly string[] {
  return (fieldsByTopic.get(topic) ?? []).map((f) => f.name);
}

/** 取回完整字段（含类型，供生成示例 payload）。 */
export function unsTopicFieldSchema(topic: string): readonly UnsField[] {
  return fieldsByTopic.get(topic) ?? [];
}

/** 按字段类型给一个合理默认值：number→0、boolean→false、其余（含 string/未知）→""。 */
function defaultForType(type: string | undefined): number | boolean | string {
  switch (type?.toLowerCase()) {
    case "number":
    case "int":
    case "integer":
    case "float":
    case "double":
      return 0;
    case "boolean":
    case "bool":
      return false;
    default:
      return "";
  }
}

/**
 * 由字段 schema 生成示例 payload 的 JSON 串（每字段一个按类型的默认值）。
 * 无字段 → 返回 undefined（调用方据此决定是否回填，不强行写 "{}"）。
 * 纯函数，便于单测。
 */
export function examplePayloadJson(fields: readonly UnsField[]): string | undefined {
  if (fields.length === 0) return undefined;
  const obj: Record<string, number | boolean | string> = {};
  for (const f of fields) {
    if (f.name) obj[f.name] = defaultForType(f.type);
  }
  if (Object.keys(obj).length === 0) return undefined;
  return JSON.stringify(obj);
}
