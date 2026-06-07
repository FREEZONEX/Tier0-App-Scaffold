// Recommended Tier0 SDK usage:
// - Import this helper, then load the SDK inside the action that actually
//   needs platform I/O. Do not statically import @tier0/sdk from pages,
//   loaders, or services that run during SSR initialization.
// - The current @tier0/sdk package is CommonJS output. Use createRequire on
//   the server so Vite/Rolldown does not execute CJS `exports` as ESM.
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

export async function loadTier0Mq(): Promise<Tier0MqModule> {
  assertServerOnly("Tier0 MQ SDK");
  return require("@tier0/sdk/mq") as Tier0MqModule;
}

export async function getTier0UnsApi() {
  return (await loadTier0OpenApi()).unsApi;
}

export async function getTier0FlowApi() {
  return (await loadTier0OpenApi()).flowApi;
}

export async function getTier0SystemApi() {
  return (await loadTier0OpenApi()).systemApi;
}

export async function getTier0ClientHelpers() {
  const { configureClient, getClient } = await loadTier0OpenApi();
  return { configureClient, getClient };
}
