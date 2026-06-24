/**
 * 从 Tier0 API key 解析 MQTT 连接凭证（workspaceID → username/clientId）。
 *
 * 修 @tier0/sdk 的 parseWorkspaceIDFromApiKey 限制：它 `split('-')` 要求恰好 3 段，
 * 但 key 的 base64url secret 含 '-' 时会 >3 段 → SDK 解析失败 → 退化成 'enterprise&open'
 * 用户名 → broker MQTT 鉴权被拒。这里重接 secret 段，正确取 workspaceID。
 * key 形如 `sk-<agent>-ws<base36Id>_<secret>`（secret 可能含 '-' / '_'）。
 */
export function workspaceIdFromApiKey(apiKey: string | undefined): string | undefined {
  if (!apiKey) return undefined;
  const parts = apiKey.trim().split("-");
  if (parts.length < 3 || parts[0] !== "sk") return undefined;
  const payload = parts.slice(2).join("-"); // 重接，容忍 secret 里的 '-'
  if (!payload.startsWith("ws")) return undefined;
  const sep = payload.indexOf("_");
  if (sep <= 2) return undefined;
  const id = parseInt(payload.slice(2, sep), 36);
  return id > 0 && !Number.isNaN(id) ? String(id) : undefined;
}

/**
 * workspaceID → 与 SDK 同款的 MQTT 凭证（username `<id>&open`，clientId `<id>&<rand>`）。
 * 解析不出则返回 undefined（交回 SDK 自行兜底）。rand 由调用方给（便于测试确定性）。
 */
export function tier0MqCredentials(
  apiKey: string | undefined,
  rand: string,
): { username: string; clientId: string } | undefined {
  const ws = workspaceIdFromApiKey(apiKey);
  return ws ? { username: `${ws}&open`, clientId: `${ws}&${rand}` } : undefined;
}
