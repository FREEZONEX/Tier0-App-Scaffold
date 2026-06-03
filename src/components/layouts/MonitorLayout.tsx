"use client";

import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { ReLoginButton } from "@/components/relogin-button";

export function MonitorLayout({
  title = "监控看板",
  subtitle = "现场运行总览",
  children,
}: {
  user?: AppUser | null;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="monitor-frame flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="monitor-header flex shrink-0 items-center justify-between border-b border-border bg-card">
        <div className="flex min-w-0 items-center gap-3">
          <div className="monitor-header-icon flex shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-highlight-text">
            <Activity className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="monitor-header-title truncate font-semibold">
              {title}
            </p>
            <p className="monitor-header-subtitle truncate">{subtitle}</p>
          </div>
        </div>
        <ReLoginButton className="h-8 shrink-0 bg-card px-2 text-xs" />
      </header>
      <main className="monitor-stage min-h-0 flex-1 overflow-hidden bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
