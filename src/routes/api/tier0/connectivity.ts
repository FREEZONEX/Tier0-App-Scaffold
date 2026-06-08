import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { getTier0ClientHelpers, getTier0SystemApi, getTier0UnsApi } from "@/lib/tier0";

type ConnectivityResult = {
  ok: boolean;
  data?: unknown;
  error?: {
    message: string;
    name?: string;
    responseData?: unknown;
    responseStatus?: number;
  };
};

function summarizeError(error: unknown): ConnectivityResult["error"] {
  if (error instanceof Error) {
    const withResponse = error as Error & {
      response?: {
        data?: unknown;
        status?: number;
      };
    };

    return {
      message: error.message,
      name: error.name,
      responseData: withResponse.response?.data,
      responseStatus: withResponse.response?.status,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
}

async function runCheck(fn: () => Promise<unknown>): Promise<ConnectivityResult> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: summarizeError(error) };
  }
}

function skipped(message: string): ConnectivityResult {
  return {
    ok: false,
    error: { message },
  };
}

export const Route = createFileRoute("/api/tier0/connectivity")({
  server: {
    handlers: {
      GET: withErrors(async () => {
        const user = await requireAuth("admin");
        const apiHost = process.env.TIER0_API_HOST;
        const apiKey = process.env.TIER0_API_KEY;
        const mqttHost = process.env.TIER0_MQTT_HOST;
        const mqttPort = process.env.TIER0_MQTT_PORT;

        let systemApi: Awaited<ReturnType<typeof getTier0SystemApi>> | null =
          null;
        let unsApi: Awaited<ReturnType<typeof getTier0UnsApi>> | null = null;

        const sdkLoad = await runCheck(async () => {
          systemApi = await getTier0SystemApi();
          unsApi = await getTier0UnsApi();
          return "loaded";
        });

        const configureClient = sdkLoad.ok
          ? await runCheck(async () => {
              if (!apiHost || !apiKey) {
                throw new Error(
                  "Tier0 runtime env missing: TIER0_API_HOST or TIER0_API_KEY",
                );
              }

              const { configureClient: configure } =
                await getTier0ClientHelpers();
              configure({ apiHost, apiKey });
              return {
                configured: true,
                hasApiHost: true,
                hasApiKey: true,
              };
            })
          : skipped("Skipped because Tier0 SDK failed to load");

        const canCallPlatform = Boolean(
          sdkLoad.ok && configureClient.ok && systemApi && unsApi,
        );

        const whoami = canCallPlatform
          ? await runCheck(() => systemApi!.openapiv1authwhoami({}))
          : skipped("Skipped because Tier0 client is not configured");

        const info = canCallPlatform
          ? await runCheck(() => systemApi!.openapiv1info({}))
          : skipped("Skipped because Tier0 client is not configured");

        const unsBrowseRoot = canCallPlatform
          ? await runCheck(() =>
              unsApi!.openapiv1unsbrowse({
                path: "/",
                max_depth: 1,
                include_leaf_value: false,
                include_metadata: false,
              }),
            )
          : skipped("Skipped because Tier0 client is not configured");

        return Response.json({
          ok:
            sdkLoad.ok &&
            configureClient.ok &&
            whoami.ok &&
            info.ok &&
            unsBrowseRoot.ok,
          checkedAt: new Date().toISOString(),
          user: {
            id: user.id,
            role: user.role,
          },
          runtime: {
            nodeEnv: process.env.NODE_ENV ?? null,
            env: {
              TIER0_API_HOST: Boolean(apiHost),
              TIER0_API_KEY: Boolean(apiKey),
              TIER0_MQTT_HOST: Boolean(mqttHost),
              TIER0_MQTT_PORT: mqttPort ?? null,
            },
          },
          checks: {
            sdkLoad,
            configureClient,
            whoami,
            info,
            unsBrowseRoot,
          },
        });
      }),
    },
  },
});
