"use client";

import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CircleAlert,
  CircleCheck,
  CircleX,
  Database,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";
import type { AppUser } from "@/lib/users";
import { useRequest } from "@/lib/hooks";
import { apiUrl, cn } from "@/lib/utils";
import type { UnsConnectivityResponse } from "./api/uns-connectivity";

export const Route = createFileRoute("/_app/")({
  component: UnsConnectivityHome,
});

type CheckStatus = UnsConnectivityResponse["checks"][number]["status"];

const STATUS_META: Record<
  CheckStatus,
  {
    label: string;
    icon: typeof CircleCheck;
    className: string;
  }
> = {
  pass: {
    label: "Passed",
    icon: CircleCheck,
    className:
      "border-highlight/40 bg-highlight-bg-accent text-highlight-text",
  },
  fail: {
    label: "Failed",
    icon: CircleX,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  skip: {
    label: "Skipped",
    icon: CircleAlert,
    className:
      "border-[var(--tier0-warning-color)]/40 bg-[var(--tier0-warning-soft)] text-[var(--tier0-warning-color)]",
  },
};

const CHECK_ICONS = {
  runtime: Server,
  sdk: Activity,
  identity: ShieldCheck,
  uns: Database,
};

function fetchUnsConnectivity(signal: AbortSignal) {
  return fetch(apiUrl("/api/uns-connectivity"), {
    signal,
    cache: "no-store",
  }).then(async (response) => {
    const body = (await response.json().catch(() => null)) as
      | UnsConnectivityResponse
      | { error?: string; cause?: string }
      | null;

    if (!response.ok) {
      const message =
        body && "error" in body && body.error
          ? body.error
          : `HTTP ${response.status} ${response.statusText}`.trim();
      throw new Error(message);
    }

    return body as UnsConnectivityResponse;
  });
}

function UnsConnectivityHome() {
  const { user } = Route.useRouteContext() as { user: AppUser };
  const { data, error, isLoading, refresh } =
    useRequest<UnsConnectivityResponse>(
      "uns-connectivity",
      fetchUnsConnectivity,
      { keepPreviousData: true },
    );

  const failedChecks = useMemo(
    () => data?.checks.filter((check) => check.status === "fail") ?? [],
    [data],
  );
  const statusLabel =
    data?.overall === "connected"
      ? "Connected"
      : data?.overall === "degraded"
        ? "Degraded"
        : data?.overall === "failed"
          ? "Failed"
          : "Checking";

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                status={
                  data?.overall === "connected"
                    ? "pass"
                    : data?.overall === "degraded"
                      ? "skip"
                      : data?.overall === "failed"
                        ? "fail"
                        : "skip"
                }
                label={statusLabel}
              />
              <span className="rounded-sm border border-border bg-surface-inset px-2 py-1 font-mono text-[11px] uppercase text-muted-foreground">
                {user.role}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-8 tracking-normal text-foreground">
              UNS Connectivity Check
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Verify that the current runtime can load the Tier0 SDK, identify
              its platform credential, and browse the UNS namespace before a
              generated app depends on live platform data.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-border bg-button-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:bg-[var(--tier0-primary-hover)] focus:border-highlight focus:outline-none focus:ring-2 focus:ring-highlight/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={refresh}
          >
            <RefreshCw
              className={cn("size-4", isLoading && "animate-spin")}
              aria-hidden="true"
            />
            Run check
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.checks ?? []).map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
          {!data &&
            ["runtime", "sdk", "identity", "uns"].map((id) => (
              <SkeletonCheckCard key={id} id={id} />
            ))}
        </section>

        {error ? (
          <section className="mt-4 rounded-sm border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <CircleX
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-destructive">
                  Connectivity request failed
                </h2>
                <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                  {error.message}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {failedChecks.length > 0 ? (
          <section className="mt-4 rounded-sm border border-destructive/30 bg-card p-4">
            <div className="flex items-start gap-3">
              <CircleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Attention required
                </h2>
                <div className="mt-3 grid gap-2">
                  {failedChecks.map((check) => (
                    <p
                      key={check.id}
                      className="rounded-sm border border-border bg-surface-inset px-3 py-2 text-sm leading-6 text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {check.label}:
                      </span>{" "}
                      {check.detail}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-6">
                  Diagnostic details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Server-side calls only; SDK credentials never reach the
                  browser.
                </p>
              </div>
              <Database
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailBlock
                label="OpenAPI host"
                value={
                  data?.runtime.apiHostConfigured
                    ? data.runtime.apiHost || "Configured"
                    : "Missing"
                }
              />
              <DetailBlock
                label="API credential"
                value={
                  data?.runtime.apiKeyConfigured ? "Injected" : "Missing"
                }
              />
              <DetailBlock
                label="Workspace"
                value={data?.identity?.workspaceName || "Unavailable"}
              />
              <DetailBlock
                label="Credential user"
                value={data?.identity?.userName || "Unavailable"}
              />
              <DetailBlock
                label="API key"
                value={
                  data?.identity?.apiKeyName
                    ? `${data.identity.apiKeyName} (${data.identity.keyPrefix ?? "no prefix"})`
                    : "Unavailable"
                }
              />
              <DetailBlock
                label="Root nodes"
                value={
                  typeof data?.uns?.rootNodeCount === "number"
                    ? String(data.uns.rootNodeCount)
                    : "Unavailable"
                }
              />
            </div>
          </div>

          <aside className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="text-base font-semibold leading-6">Session</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current app gateway identity.
                </p>
              </div>
              <KeyRound
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            <div className="mt-4 space-y-4">
              <DetailBlock label="Signed in as" value={user.displayName} />
              <DetailBlock label="Selected role" value={user.role} />
              <DetailBlock
                label="Last checked"
                value={
                  data
                    ? `${new Date(data.checkedAt).toLocaleTimeString()} (${data.durationMs} ms)`
                    : "Pending"
                }
              />
              <DetailBlock
                label="Credential roles"
                value={data?.identity?.roles?.join(", ") || "Unavailable"}
              />
              <DetailBlock
                label="Permissions"
                value={
                  data?.identity?.permissions?.length
                    ? data.identity.permissions.join(", ")
                    : "Unavailable"
                }
              />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: CheckStatus;
  label?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium",
        meta.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label ?? meta.label}
    </span>
  );
}

function CheckCard({
  check,
}: {
  check: UnsConnectivityResponse["checks"][number];
}) {
  const Icon = CHECK_ICONS[check.id as keyof typeof CHECK_ICONS] ?? Activity;

  return (
    <article className="min-h-32 rounded-sm border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-inset">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <StatusPill status={check.status} />
      </div>
      <h2 className="mt-3 text-sm font-semibold leading-5 text-foreground">
        {check.label}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {check.detail}
      </p>
    </article>
  );
}

function SkeletonCheckCard({ id }: { id: string }) {
  const Icon = CHECK_ICONS[id as keyof typeof CHECK_ICONS] ?? Activity;

  return (
    <article className="min-h-32 rounded-sm border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-inset">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <StatusPill status="skip" label="Pending" />
      </div>
      <div className="mt-3 h-4 w-32 rounded-sm bg-surface-inset" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded-sm bg-surface-inset" />
        <div className="h-3 w-2/3 rounded-sm bg-surface-inset" />
      </div>
    </article>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-border bg-surface-inset px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium leading-5 text-foreground">
        {value}
      </p>
    </div>
  );
}
