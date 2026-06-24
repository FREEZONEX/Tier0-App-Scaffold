import { parseMimic, type ParseResult } from "./schema";

/** 解析上传的 schema 文件文本：先 JSON.parse，再走 mimic 校验。绝不抛异常。 */
export function parseSchemaFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "不是合法 JSON" };
  }
  return parseMimic(raw);
}
