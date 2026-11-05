// Recommended Tier0 SDK usage:
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

export type Tier0SdkModule = typeof import("@tier0/sdk");
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

/** The platform-injected key identifies the App, never the current human user. */
export async function getTier0AppClient() {
  assertServerOnly("Tier0 App SDK");
  const apiKey = process.env.TIER0_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("Tier0 App SDK requires the platform-injected TIER0_API_KEY");
  }
  const { createTier0Client } = require("@tier0/sdk") as Tier0SdkModule;
  if (typeof createTier0Client !== "function") {
    throw new Error("Tier0 App SDK requires a version with createTier0Client");
  }
  return createTier0Client({ apiHost: process.env.TIER0_API_HOST, apiKey });
}

export async function getTier0UnsApi() {
  return (await getTier0AppClient()).unsApi;
}

export async function getTier0FlowApi() {
  return (await getTier0AppClient()).flowApi;
}

export async function getTier0SystemApi() {
  return (await getTier0AppClient()).systemApi;
}

export async function getTier0AppFiles() {
  return (await getTier0AppClient()).files;
}

/** Legacy process-wide configuration; do not use to switch request identities. */
export async function getTier0ClientHelpers() {
  const { configureClient, getClient } = await loadTier0OpenApi();
  return { configureClient, getClient };
}
