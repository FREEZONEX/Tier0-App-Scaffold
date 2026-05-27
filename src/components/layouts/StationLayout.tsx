"use client";

import { type ReactNode } from "react";
import { Activity, Factory } from "lucide-react";
import type { AppUser } from "@/lib/users";

export function StationLayout({
  user,
  children,
}: {
  user?: AppUser | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-highlight-text">
            <Factory className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-6">Station</p>
            <p className="caption truncate">Task operation</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-inset px-3 py-2">
          <Activity className="size-4 shrink-0 text-highlight-text" />
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium leading-5">
              {user?.displayName ?? "Loading"}
            </p>
            <p className="font-mono text-xs uppercase text-muted-foreground">
              {user?.role ?? ""}
            </p>
          </div>
        </div>
      </header>
      <main className="page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
