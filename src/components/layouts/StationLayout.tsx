"use client";

import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { APP_ICON, APP_NAME } from "@/lib/app-chrome";

export function StationLayout({
  user,
  children,
}: {
  user?: AppUser | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-highlight-text">
            <img
              src={APP_ICON}
              alt={`${APP_NAME} icon`}
              className="size-full rounded-[inherit] object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-6">Station Work</p>
            <p className="caption truncate">Current Task</p>
          </div>
        </div>
        <div className="flex min-w-0 items-stretch gap-2 sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 sm:flex-none">
            <Activity className="size-4 shrink-0 text-highlight-text" />
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium leading-5">
                {user?.displayName ?? "Loading"}
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
