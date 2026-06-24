/** payload 模板解析：合法 JSON 按 JSON 发，否则按原始字符串发（MQTT payload 可为纯文本）。 */
export function parsePayload(template: string): unknown {
  try {
    return JSON.parse(template);
  } catch {
    return template;
  }
}
