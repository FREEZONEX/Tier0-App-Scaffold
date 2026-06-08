import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CircleAlert,
  CircleCheck,
  Database,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiUrl, cn } from "@/lib/utils";

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

type ConnectivityResponse = {
  ok: boolean;
  checkedAt: string;
  user: {
    id: string;
    role: string;
  };
  runtime: {
    nodeEnv: string | null;
    env: {
      TIER0_API_HOST: boolean;
      TIER0_API_KEY: boolean;
      TIER0_MQTT_HOST: boolean;
      TIER0_MQTT_PORT: string | null;
    };
  };
  checks: {
    sdkLoad: ConnectivityResult;
    configureClient: ConnectivityResult;
    whoami: ConnectivityResult;
    info: ConnectivityResult;
    unsBrowseRoot: ConnectivityResult;
  };
};

export const Route = createFileRoute("/_app/uns-connectivity")({
  component: UnsConnectivityPage,
});

function UnsConnectivityPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectivityResponse | null>(null);

  const cards = useMemo(() => {
    if (!result) return [];

    return [
      {
        key: "sdk-load",
        title: "SDK 加载",
        icon: Server,
        result: result.checks.sdkLoad,
      },
      {
        key: "configure-client",
        title: "客户端配置",
        icon: KeyRound,
        result: result.checks.configureClient,
      },
      {
        key: "whoami",
        title: "鉴权身份",
        icon: ShieldCheck,
        result: result.checks.whoami,
      },
      {
        key: "info",
        title: "平台信息",
        icon: Database,
        result: result.checks.info,
      },
      {
        key: "browse",
        title: "UNS 根节点浏览",
        icon: Activity,
        result: result.checks.unsBrowseRoot,
      },
    ];
  }, [result]);

  async function runConnectivityTest() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/tier0/connectivity"), {
        method: "GET",
        credentials: "include",
      });
      const body = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(body?.error ?? "UNS 联通测试失败");
        return;
      }
      setResult(body as ConnectivityResponse);
    } catch (fetchError) {
      setResult(null);
      setError(
        fetchError instanceof Error ? fetchError.message : "网络请求失败",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-sm border border-highlight-bg-primary bg-highlight-bg-accent px-2.5 py-1 text-xs font-medium text-highlight-foreground">
              <Activity className="size-3.5" />
              UNS 联通
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">
              UNS 连通性测试
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              通过当前应用后端运行时检查 Tier0 SDK、平台鉴权和 UNS browse 链路。
            </p>
          </div>
          <button
            type="button"
            onClick={runConnectivityTest}
            disabled={loading}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-button-primary px-4 text-sm font-medium text-primary-foreground transition-opacity",
              loading ? "cursor-wait opacity-70" : "hover:opacity-90",
            )}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {loading ? "测试中" : "开始测试"}
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EnvCard
            label="TIER0_API_HOST"
            value={result?.runtime.env.TIER0_API_HOST ?? null}
          />
          <EnvCard
            label="TIER0_API_KEY"
            value={result?.runtime.env.TIER0_API_KEY ?? null}
          />
          <EnvCard
            label="TIER0_MQTT_HOST"
            value={result?.runtime.env.TIER0_MQTT_HOST ?? null}
          />
          <PortCard value={result?.runtime.env.TIER0_MQTT_PORT ?? null} />
        </section>

        {error ? (
          <section className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {result ? (
          <>
            <section className="grid gap-4 xl:grid-cols-3">
              <SummaryCard
                title="整体状态"
                value={result.ok ? "通过" : "失败"}
                tone={result.ok ? "success" : "error"}
                helper={`检查时间：${formatDate(result.checkedAt)}`}
              />
              <SummaryCard
                title="当前用户"
                value={result.user.id}
                tone="neutral"
                helper={`角色：${result.user.role}`}
              />
              <SummaryCard
                title="运行环境"
                value={result.runtime.nodeEnv ?? "unknown"}
                tone="neutral"
                helper="来自应用后端 runtime"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {cards.map((card) => (
                <ResultCard
                  key={card.key}
                  title={card.title}
                  icon={card.icon}
                  result={card.result}
                />
              ))}
            </section>
          </>
        ) : (
          <section className="rounded-md border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              还没有测试结果
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              点击“开始测试”后，这里会显示后端运行时的 UNS 联通结果。
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function EnvCard({ label, value }: { label: string; value: boolean | null }) {
  const ok = value === true;
  const unknown = value === null;

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {unknown ? (
          <CircleAlert className="size-4 text-amber-600" />
        ) : ok ? (
          <CircleCheck className="size-4 text-emerald-600" />
        ) : (
          <CircleAlert className="size-4 text-red-600" />
        )}
        <span className="text-sm font-medium text-foreground">
          {unknown ? "未检测" : ok ? "已注入" : "缺失"}
        </span>
      </div>
    </div>
  );
}

function PortCard({ value }: { value: string | null }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        TIER0_MQTT_PORT
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Server className="size-4 text-sky-600" />
        <span className="text-sm font-medium text-foreground">
          {value ?? "未检测"}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  tone: "success" | "error" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p
        className={cn(
          "mt-3 text-lg font-semibold",
          tone === "success" && "text-emerald-700",
          tone === "error" && "text-red-700",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function ResultCard({
  title,
  icon: Icon,
  result,
}: {
  title: string;
  icon: typeof ShieldCheck;
  result: ConnectivityResult;
}) {
  return (
    <article className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-md border",
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            <Icon className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {result.ok ? "执行成功" : result.error?.message ?? "执行失败"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-sm px-2 py-1 text-xs font-medium",
            result.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          )}
        >
          {result.ok ? "PASS" : "FAIL"}
        </span>
      </div>

      <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-foreground">
          {JSON.stringify(result.ok ? result.data : result.error, null, 2)}
        </pre>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
