"use client";

import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { APP_ICON, APP_NAME, uiText } from "@/lib/app-chrome";
import { getRoleMetadata } from "@/lib/role-metadata";

/**
 * StationLayout — task-first chrome for shop-floor execution (工位). The header
 * names the app and, when given, the operator's current context (工位、班次、当前
 * 任务) so a glance tells them where they are; the signed-in operator and their
 * roles sit on the right. Pages own their own spacing.
 */
export function StationLayout({
  user,
  title = APP_NAME,
  context,
  actions,
  children,
}: {
  user?: AppUser | null;
  /** Header title; defaults to the app name. */
  title?: ReactNode;
  /** Second line, e.g. 「装配二线 · 工位 A-03 · 白班」. Omitted when not given. */
  context?: ReactNode;
  /** Header actions beside the operator (e.g. 交接班). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px]">
            <img
              src={APP_ICON}
              alt=""
              aria-hidden="true"
              className="size-full rounded-[inherit] object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-6">{title}</h1>
            {context ? <p className="caption truncate">{context}</p> : null}
          </div>
        </div>
        <div className="flex min-w-0 items-stretch gap-2 sm:items-center">
          {actions}
          <UserBadge user={user} icon={<Activity className="size-4 shrink-0 text-brand" aria-hidden="true" />} />
        </div>
      </header>
      <OfflineBanner />
      <main className="page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}

function UserBadge({ user, icon }: { user?: AppUser | null; icon: ReactNode }) {
  const roles = (user?.roles ?? []).map((role) => getRoleMetadata(role).label).join(" · ");
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-border bg-surface-inset px-3 py-2 sm:flex-none"
      aria-label={uiText("signedInAs")}
      role="group"
    >
      {icon}
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-medium leading-5">
          {user?.displayName ?? uiText("loading")}
        </p>
        {user ? (
          <p className="caption truncate" title={roles || undefined}>
            {roles || uiText("noRoles")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
