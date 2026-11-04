"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Activity,
  ClipboardList,
  Coins,
  Factory,
  LayoutDashboard,
  Menu,
  ScrollText,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";

type SceneKey =
  | "SceneTaskOps"
  | "SceneAdminDirectory"
  | "SceneOpsMonitor"
  | "SceneEmptyContrast"
  | "SceneWorkflowHub"
  | "SceneAuditTimeline"
  | "SceneAgentSpend";

/** Shell-aligned scene chrome: desktop rail + mobile drawer (md breakpoint). */
const GROUPS: {
  title: string;
  items: { key: SceneKey; label: string; icon: typeof ClipboardList }[];
}[] = [
  {
    title: "Platform",
    items: [
      { key: "SceneTaskOps", label: "任务运营台", icon: ClipboardList },
      { key: "SceneOpsMonitor", label: "产线监控", icon: Factory },
      { key: "SceneWorkflowHub", label: "工作流总览", icon: Workflow },
    ],
  },
  {
    title: "Organization",
    items: [
      { key: "SceneAdminDirectory", label: "成员目录", icon: Users },
      { key: "SceneAuditTimeline", label: "审计日志", icon: ScrollText },
    ],
  },
  {
    title: "Data",
    items: [
      { key: "SceneEmptyContrast", label: "数据状态", icon: LayoutDashboard },
      { key: "SceneAgentSpend", label: "用量与成本", icon: Coins },
    ],
  },
];

function SceneNav({
  active,
  className,
  onNavigate,
  navId,
}: {
  active: SceneKey;
  className?: string;
  onNavigate?: () => void;
  navId?: string;
}) {
  return (
    <aside
      id={navId}
      className={cn("flex w-56 shrink-0 flex-col border-r border-border bg-sidebar", className)}
      aria-label="应用导航"
    >
      <div className="flex h-14 items-center gap-2.5 px-3">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[4px] bg-[color:var(--tier0-cta)] text-[color:var(--tier0-cta-foreground)] dark:bg-[#050b14] dark:text-[color:var(--tier0-cta)] dark:ring-1 dark:ring-[color-mix(in_srgb,var(--tier0-cta)_40%,transparent)]">
          <Activity size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</p>
          <p className="truncate text-xs text-muted-foreground">业务验收</p>
        </div>
        {onNavigate ? (
          <button
            type="button"
            aria-label="关闭导航"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tier0-cta)]/40 md:hidden"
            onClick={onNavigate}
          >
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-auto overscroll-contain px-2 pb-4 pt-1">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ key, label, icon: Icon }) => {
                const current = key === active;
                return (
                  <li key={key}>
                    <span
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-[4px] px-2.5 text-sm font-medium",
                        "transition-colors",
                        current
                          ? "bg-[color-mix(in_srgb,var(--tier0-cta)_18%,transparent)] text-foreground ring-1 ring-[color-mix(in_srgb,var(--tier0-cta)_45%,transparent)]"
                          : "text-secondary-foreground",
                      )}
                    >
                      <Icon size={16} className="shrink-0 opacity-70" aria-hidden />
                      <span className="truncate">{label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function SceneShell({
  active,
  children,
}: {
  active: SceneKey;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navId = useId();
  const activeLabel =
    GROUPS.flatMap((g) => g.items).find((item) => item.key === active)?.label ??
    APP_NAME;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-[min(720px,100dvh)] min-w-0 bg-background">
      <div className="hidden md:flex">
        <SceneNav active={active} />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden" role="presentation">
          <button
            type="button"
            aria-label="关闭导航"
            className="absolute inset-0 bg-black/40 supports-[backdrop-filter]:bg-black/30 supports-[backdrop-filter]:backdrop-blur-[2px] animate-[tier0-fade_160ms_ease-out]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-full max-w-[min(18rem,calc(100vw-0.75rem))] p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] animate-[tier0-drawer-left_220ms_var(--motion-ease)]">
            <SceneNav
              active={active}
              navId={navId}
              className="h-full w-full overflow-hidden rounded-[4px] border border-sidebar-border shadow-lg"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:hidden">
          <button
            type="button"
            aria-label="打开导航"
            aria-expanded={mobileOpen}
            aria-controls={navId}
            className="inline-flex size-9 items-center justify-center rounded-[4px] border border-border bg-card text-foreground shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tier0-cta)]/40 active:scale-95"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={16} aria-hidden />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{activeLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{APP_NAME}</p>
          </div>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-background">
          {/* WorkbenchLayout / page-shell own responsive padding */}
          {children}
        </main>
      </div>
    </div>
  );
}
