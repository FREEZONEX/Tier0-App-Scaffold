"use client";

import { type ReactNode } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { APP_NAME, uiText } from "@/lib/app-chrome";
import { getRoleMetadata } from "@/lib/role-metadata";

/**
 * ReviewLayout — evidence-first chrome for review and decisions (审核、判定).
 * Title defaults to the app name; `context` names what is being reviewed
 * (「来料检验 · 待判定 12 批」). The reviewer and their roles sit on the right.
 */
export function ReviewLayout({
  user,
  title = APP_NAME,
  context,
  actions,
  children,
}: {
  user?: AppUser | null;
  /** Header title; defaults to the app name. */
  title?: ReactNode;
  /** Second line: the queue or object under review. Omitted when not given. */
  context?: ReactNode;
  /** Header actions beside the reviewer. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[4px] border border-state-info-border bg-state-info-bg text-state-info-fg">
            <ClipboardCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-6">{title}</h1>
            {context ? <p className="caption truncate">{context}</p> : null}
          </div>
        </div>
        <div className="flex min-w-0 items-stretch gap-2 sm:items-center">
          {actions}
          <UserBadge user={user} icon={<ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />} />
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
