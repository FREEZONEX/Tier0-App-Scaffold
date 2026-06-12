import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { getTier0SystemApi, getTier0UnsApi } from "@/lib/tier0";
import { withErrors } from "@/lib/route-handlers";

type CheckStatus = "pass" | "fail" | "skip";
type OverallStatus = "connected" | "degraded" | "failed";

interface ConnectivityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

interface RuntimeIdentity {
  userName?: string;
  email?: string;
  workspaceName?: string;
  apiKeyName?: string;
  keyPrefix?: string;
  keyType?: string;
  roles?: string[];
  permissions?: string[];
}

export interface UnsConnectivityResponse {
  overall: OverallStatus;
  checkedAt: string;
  durationMs: number;
  runtime: {
    apiHostConfigured: boolean;
    apiHost?: string;
    apiKeyConfigured: boolean;
  };
  appSession: {
    displayName: string;
    role: string;
  };
  checks: ConnectivityCheck[];
  identity?: RuntimeIdentity;
  uns?: {
    code?: number;
    msg?: string;
    rootNodeCount: number;
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getOverall(checks: ConnectivityCheck[]): OverallStatus {
  if (checks.some((check) => check.status === "fail")) {
    return "failed";
  }
  if (checks.some((check) => check.status === "skip")) {
    return "degraded";
  }
  return "connected";
}

function getRuntimeEnv() {
  const apiHost = process.env.TIER0_API_HOST?.trim();
  const apiKey = process.env.TIER0_API_KEY?.trim();

  return {
    apiHost,
    apiHostConfigured: Boolean(apiHost),
    apiKeyConfigured: Boolean(apiKey),
  };
}

export const Route = createFileRoute("/api/uns-connectivity")({
  server: {
    handlers: {
      GET: withErrors(async () => {
        const startedAt = Date.now();
        const user = await requireAuth();
        const runtime = getRuntimeEnv();
        const checks: ConnectivityCheck[] = [
          {
            id: "runtime",
            label: "Runtime environment",
            status:
              runtime.apiHostConfigured && runtime.apiKeyConfigured
                ? "pass"
                : "fail",
            detail:
              runtime.apiHostConfigured && runtime.apiKeyConfigured
                ? "Tier0 OpenAPI host and API credential are available."
                : "Missing TIER0_API_HOST or TIER0_API_KEY in the runtime.",
          },
        ];

        const responseBase = {
          checkedAt: new Date().toISOString(),
          runtime: {
            apiHostConfigured: runtime.apiHostConfigured,
            apiHost: runtime.apiHost,
            apiKeyConfigured: runtime.apiKeyConfigured,
          },
          appSession: {
            displayName: user.displayName,
            role: user.role,
          },
        };

        if (!runtime.apiHostConfigured || !runtime.apiKeyConfigured) {
          const payload: UnsConnectivityResponse = {
            ...responseBase,
            overall: getOverall(checks),
            durationMs: Date.now() - startedAt,
            checks,
          };
          return Response.json(payload, { status: 200 });
        }

        let systemApi: Awaited<ReturnType<typeof getTier0SystemApi>>;
        let unsApi: Awaited<ReturnType<typeof getTier0UnsApi>>;

        try {
          systemApi = await getTier0SystemApi();
          unsApi = await getTier0UnsApi();
          checks.push({
            id: "sdk",
            label: "SDK runtime",
            status: "pass",
            detail: "@tier0/sdk loaded through the server-side lazy loader.",
          });
        } catch (error) {
          checks.push({
            id: "sdk",
            label: "SDK runtime",
            status: "fail",
            detail: getErrorMessage(error),
          });
          const payload: UnsConnectivityResponse = {
            ...responseBase,
            overall: getOverall(checks),
            durationMs: Date.now() - startedAt,
            checks,
          };
          return Response.json(payload, { status: 200 });
        }

        let identity: RuntimeIdentity | undefined;

        try {
          const result = await systemApi.openapiv1authwhoami();
          identity = result?.data;
          checks.push({
            id: "identity",
            label: "Runtime identity",
            status: result?.code === 200 && result?.data ? "pass" : "fail",
            detail:
              result?.code === 200 && result?.data
                ? `Authenticated as ${result.data.userName} in ${result.data.workspaceName}.`
                : result?.msg || "The runtime credential did not return identity data.",
          });
        } catch (error) {
          checks.push({
            id: "identity",
            label: "Runtime identity",
            status: "fail",
            detail: getErrorMessage(error),
          });
        }

        let uns: UnsConnectivityResponse["uns"];

        try {
          const result = await unsApi.openapiv1unsbrowse({
            include_leaf_value: false,
            include_metadata: false,
            max_depth: 1,
          });
          const tree = Array.isArray(result?.data?.tree)
            ? result.data.tree
            : [];
          uns = {
            code: result?.code,
            msg: result?.msg,
            rootNodeCount: tree.length,
          };
          checks.push({
            id: "uns",
            label: "UNS namespace",
            status: result?.code === 200 ? "pass" : "fail",
            detail:
              result?.code === 200
                ? `Root browse completed with ${tree.length} node${tree.length === 1 ? "" : "s"}.`
                : result?.msg || "UNS browse did not return a successful response.",
          });
        } catch (error) {
          checks.push({
            id: "uns",
            label: "UNS namespace",
            status: "fail",
            detail: getErrorMessage(error),
          });
        }

        const payload: UnsConnectivityResponse = {
          ...responseBase,
          overall: getOverall(checks),
          durationMs: Date.now() - startedAt,
          checks,
          identity,
          uns,
        };

        return Response.json(payload, { status: 200 });
      }),
    },
  },
});
