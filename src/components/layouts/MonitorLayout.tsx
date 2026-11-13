"use client";

import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { APP_NAME, uiText } from "@/lib/app-chrome";

function formatClock(value: Date | string | number): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/**
 * MonitorLayout — passive board chrome for wall screens (现场大屏). Title
 * defaults to the app name; `subtitle` names the area (「一号线 · 实时概览」).
 * Pass `updatedAt` (the time of the data on screen, not the wall clock) so
 * viewers can tell live data from stale data at a distance.
 *
 * Board content: `.monitor-board` > `.monitor-kpis` (`.monitor-kpi-tile` with
 * `.monitor-label` + `.monitor-kpi`) then `.monitor-columns` (`.monitor-panel`
 * lists of `.monitor-row`). Tiles size to content and wrap by width; do not
 * place KPIs in fixed `.monitor-grid` rows, which stretch them into empty boxes.
 */
export function MonitorLayout({
  title = APP_NAME,
  subtitle,
  updatedAt,
  children,
}: {
  user?: AppUser | null;
  title?: ReactNode;
  /** Area or scope shown under the title. Omitted when not given. */
  subtitle?: ReactNode;
  /** Time of the data on screen; shown as 「更新于 08:30:15」. */
  updatedAt?: Date | string | number | null;
  children: ReactNode;
}) {
  const clock = updatedAt === undefined || updatedAt === null ? null : formatClock(updatedAt);
  return (
    <div className="monitor-frame flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="monitor-header flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card">
        <div className="flex min-w-0 items-center gap-3">
          <div className="monitor-header-icon flex shrink-0 items-center justify-center rounded-[4px] bg-muted text-foreground">
            <Activity className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="monitor-header-title truncate font-semibold">
              {title}
            </h1>
            {subtitle ? <p className="monitor-header-subtitle truncate">{subtitle}</p> : null}
          </div>
        </div>
        {clock ? (
          <p className="monitor-header-meta shrink-0 tabular-nums" aria-live="off">
            {uiText("updatedAt")} {clock}
          </p>
        ) : null}
      </header>
      <OfflineBanner />
      <main className="monitor-stage page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
