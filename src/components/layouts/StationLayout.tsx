"use client";

import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { APP_ICON, APP_NAME } from "@/lib/app-chrome";
import { BackButton, type BackTarget } from "@/components/ui/back-button";

export function StationLayout({
  user,
  title = "Station Work",
  subtitle = "Current Task",
  actions,
  back,
  children,
}: {
  user?: AppUser | null;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Header actions beside the operator block, e.g. a link back to the workspace. */
  actions?: ReactNode;
  /** Where the station returns to (the workspace page that opened it). */
  back?: BackTarget;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {back ? <BackButton {...back} className="size-10" /> : null}
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px]">
            <img
              src={APP_ICON}
              alt={`${APP_NAME} icon`}
              className="size-full rounded-[inherit] object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-6">{title}</p>
            <p className="caption truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-stretch gap-2 sm:items-center">
          {actions}
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-border bg-surface-inset px-3 py-2 sm:flex-none">
            <Activity className="size-4 shrink-0 text-brand" />
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium leading-5">
                {user?.displayName ?? "…"}
              </p>
            </div>
          </div>
        </div>
      </header>
      <main className="page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
