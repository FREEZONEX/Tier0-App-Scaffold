import { createMockSource } from "./mock-source";
import { createTier0Source, makeTier0Client } from "./tier0-source";
import { mockSpecsFromSchema } from "./mock-spec";
import type { DataSource } from "./data-source";
import type { Tier0Config } from "./tier0-config";
import type { Mimic } from "@/hmi/schema/schema";

/**
 * 有 Tier0 配置（mqttHost 非空）用真实 Tier0 源；否则 mock 兜底（喂当前图仿真数据，本地/E2E 不破）。
 * config 由 server fn `getTier0ConfigFn` 取得（服务端读无前缀 `process.env.TIER0_*`），不再读 `import.meta.env`。
 */
export function createDataSource(
  schema: Mimic,
  topics: readonly string[],
  config: Tier0Config | null,
): DataSource {
  return config?.mqttHost
    ? createTier0Source(topics, () => makeTier0Client(config))
    : createMockSource(mockSpecsFromSchema(schema));
}

export type DataSourceKind = "demo" | "mock" | "real";

/**
 * 当前数据源类别，驱动 UI 徽标（让用户始终知道画面被什么驱动）：
 * - `demo`：空图回落到内置示例图（mock 数据），仅作首屏演示
 * - `mock`：真实图但未配 broker，喂确定性仿真数据
 * - `real`：连上真实 MQTT broker
 */
export function dataSourceKind(
  isDemo: boolean,
  config: Tier0Config | null,
): DataSourceKind {
  if (isDemo) return "demo";
  return config?.mqttHost ? "real" : "mock";
}
