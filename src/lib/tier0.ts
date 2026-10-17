// Recommended Tier0 SDK usage (files, notifications, members, platform info):
// - Import this helper, then load the SDK inside the action that actually
//   needs platform I/O. Do not statically import @tier0/sdk from pages,
//   loaders, or services that run during SSR initialization.
// - @tier0/sdk publishes dual ESM/CJS output. These server helpers use
//   createRequire so SSR consistently loads the CJS condition while client
//   bundles can resolve the ESM condition when explicitly imported.
// - Business pages should not expose SDK auth or connection configuration UI.
import { createRequire } from "node:module";

export type {
  ClientConfig as Tier0ClientConfig,
  components as Tier0ApiComponents,
} from "@tier0/sdk/openapi";
export type {
  MQTTConfig as Tier0MQTTConfig,
  MQTTEventMap as Tier0MQTTEventMap,
  MQTTMessage as Tier0MQTTMessage,
  TopicHandler as Tier0TopicHandler,
} from "@tier0/sdk/mq";

export type Tier0OpenApiModule = typeof import("@tier0/sdk/openapi");
export type Tier0FilesModule = typeof import("@tier0/sdk/files");
export type Tier0MqModule = typeof import("@tier0/sdk/mq");

const require = createRequire(import.meta.url);

function assertServerOnly(moduleName: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${moduleName} must be loaded from a server action or API route.`);
  }
}

export async function loadTier0OpenApi(): Promise<Tier0OpenApiModule> {
  assertServerOnly("Tier0 OpenAPI SDK");
  return require("@tier0/sdk/openapi") as Tier0OpenApiModule;
}

export async function loadTier0Files(): Promise<Tier0FilesModule> {
  assertServerOnly("Tier0 Files SDK");
  return require("@tier0/sdk/files") as Tier0FilesModule;
}

export async function loadTier0Mq(): Promise<Tier0MqModule> {
  assertServerOnly("Tier0 MQ SDK");
  return require("@tier0/sdk/mq") as Tier0MqModule;
}

// UNS data (collections, records, samples, latest values, live changes) is NOT
// read through the SDK: the SDK's unsApi / flowApi target the retired v1 topic
// API and the platform no longer serves it. Use `@/lib/uns.server` (server) and
// `@/lib/uns-live` (browser) instead. Node-RED flows no longer exist.

export async function getTier0SystemApi() {
  return (await loadTier0OpenApi()).systemApi;
}

export async function getTier0ClientHelpers() {
  const { configureClient, getClient } = await loadTier0OpenApi();
  return { configureClient, getClient };
}
