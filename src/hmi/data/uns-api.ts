import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  browseChildrenOf, searchToTopics, readToValues, historyResults,
  type UnsTopic,
} from "./uns-normalize";
import { serializeHistory, type SerialHistoryItem } from "./uns-history";

// 给组件层一个统一入口（type-ahead 从这里取类型 + server fn）。
export type { UnsTopic } from "./uns-normalize";

// 读 env：部署平台把**无前缀** TIER0_* 注入 process.env（与 MQTT 配置同源，见 tier0-config.ts）。
// 仅认无前缀这一套命名，不再读 VITE_ 前缀。兜底也试 import.meta.env（dev/SSR）。
const metaEnv = (k: string): string | undefined => {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[k];
  } catch {
    return undefined;
  }
};
const env = (k: string): string | undefined => {
  const fromProcess = typeof process !== "undefined" ? process.env?.[k] : undefined;
  return fromProcess || metaEnv(k) || undefined;
};
const apiHost = (): string | undefined => env("TIER0_API_HOST");
const apiKey = (): string | undefined => env("TIER0_API_KEY");

/** 是否配了 UNS（server 侧判断）。无 host → 调用会抛，故提前短路。 */
const configured = (): boolean => !!apiHost();

export const browseUnsFn = createServerFn({ method: "POST" })
  .inputValidator((input: { path?: string; maxDepth?: number }) =>
    z.object({ path: z.string().optional(), maxDepth: z.number().int().positive().max(10).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean; topics: UnsTopic[] }> => {
    if (!configured()) return { available: false, topics: [] };
    try {
      const { loadTier0OpenApi } = await import("@/lib/tier0");
      const { configureClient, unsApi } = await loadTier0OpenApi();
      configureClient({ getApiHost: apiHost, getApiKey: apiKey });
      const resp = await unsApi.openapiv1unsbrowse({
        path: data.path, max_depth: data.maxDepth ?? 3, include_metadata: true,
      });
      return { available: true, topics: browseChildrenOf(resp, data.path ?? "") };
    } catch (err) {
      console.error("[uns-api] browse failed:", data.path ?? "(root)", err);
      return { available: false, topics: [] };
    }
  });

export const searchUnsFn = createServerFn({ method: "POST" })
  .inputValidator((input: { keyword: string; pathPrefix?: string; page?: number; size?: number }) =>
    z.object({
      keyword: z.string(), pathPrefix: z.string().optional(),
      page: z.number().int().positive().optional(), size: z.number().int().positive().max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean; items: UnsTopic[]; total: number }> => {
    if (!configured()) return { available: false, items: [], total: 0 };
    try {
      const { loadTier0OpenApi } = await import("@/lib/tier0");
      const { configureClient, unsApi } = await loadTier0OpenApi();
      configureClient({ getApiHost: apiHost, getApiKey: apiKey });
      const resp = await unsApi.openapiv1unssearch({
        keyword: data.keyword, path_prefix: data.pathPrefix,
        page: data.page ?? 1, size: data.size ?? 30, include_metadata: true,
      });
      const r = searchToTopics(resp);
      return { available: true, items: r.items, total: r.total };
    } catch (err) {
      console.error("[uns-api] search failed:", data.keyword, err);
      return { available: false, items: [], total: 0 };
    }
  });

/** 读一批 topic 的当前值（首帧）：数据源连接时拉一次塞进 tag-store，让静态/低频 UNS 指标也能显示。 */
export const readUnsFn = createServerFn({ method: "POST" })
  .inputValidator((input: { topics: string[] }) =>
    z.object({ topics: z.array(z.string()).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean; values: { topic: string; valueJson: string }[] }> => {
    if (!configured() || data.topics.length === 0) return { available: false, values: [] };
    try {
      const { loadTier0OpenApi } = await import("@/lib/tier0");
      const { configureClient, unsApi } = await loadTier0OpenApi();
      configureClient({ getApiHost: apiHost, getApiKey: apiKey });
      const resp = await unsApi.openapiv1unsread({ topics: data.topics, include_leaf_value: true });
      return { available: true, values: readToValues(resp) };
    } catch (err) {
      console.error("[uns-api] read failed:", data.topics.length, "topics", err);
      return { available: false, values: [] };
    }
  });

/**
 * 历史数据查询：趋势走聚合（带 aggregation）、表格走原始分页（不带 aggregation）。
 * 一次查多个 topic（趋势跨 topic 对比 / 表格单 topic）。无 host 或异常 → available:false。
 */
export const historyUnsFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      topics: string[];
      startTime: string;
      endTime: string;
      page?: number;
      size?: number;
      aggregation?: { field: string; function: string; interval: string };
    }) =>
      z
        .object({
          topics: z.array(z.string().min(1)).min(1).max(20),
          startTime: z.string().min(1),
          endTime: z.string().min(1),
          page: z.number().int().positive().optional(),
          size: z.number().int().positive().max(5000).optional(),
          aggregation: z
            .object({ field: z.string().min(1), function: z.string().min(1), interval: z.string().min(1) })
            .optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean; items: SerialHistoryItem[]; total: number }> => {
    if (!configured() || data.topics.length === 0) return { available: false, items: [], total: 0 };
    try {
      const { loadTier0OpenApi } = await import("@/lib/tier0");
      const { configureClient, unsApi } = await loadTier0OpenApi();
      configureClient({ getApiHost: apiHost, getApiKey: apiKey });
      const resp = await unsApi.openapiv1unshistory({
        topics: data.topics,
        start_time: data.startTime,
        end_time: data.endTime,
        page: data.page,
        size: data.size,
        aggregation: data.aggregation,
      });
      const { items, total } = historyResults(resp);
      return { available: true, items: serializeHistory(items), total };
    } catch (err) {
      console.error("[uns-api] history failed:", data.topics.join(","), err);
      return { available: false, items: [], total: 0 };
    }
  });
