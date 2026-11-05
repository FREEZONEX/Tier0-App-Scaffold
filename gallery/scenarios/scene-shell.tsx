"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Factory,
  LayoutDashboard,
  Menu,
  ScrollText,
  Workflow,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";

type SceneKey =
  | "SceneTaskOps"
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

const railEase = "ease-[cubic-bezier(0.2,0,0,1)]";

function SceneNav({
  active,
  className,
  onNavigate,
  navId,
  collapsed = false,
  onToggleCollapsed,
}: {
  active: SceneKey;
  className?: string;
  onNavigate?: () => void;
  navId?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const showBrand = !collapsed || Boolean(onNavigate);

  return (
    <aside
      id={navId}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar",
        "transition-[width] duration-200",
        railEase,
        onNavigate ? "w-full" : collapsed ? "w-16" : "w-56",
        className,
      )}
      aria-label="应用导航"
    >
      <div
        className={cn(
          "flex min-h-14 items-center px-3 py-2.5",
          "transition-[gap,padding] duration-200",
          railEase,
          showBrand ? "gap-2.5" : "justify-center gap-0",
        )}
      >
        {showBrand ? (
          <>
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[4px] bg-[color:var(--tier0-cta)] text-[color:var(--tier0-cta-foreground)] dark:bg-[#050b14] dark:text-[color:var(--tier0-cta)] dark:ring-1 dark:ring-[color-mix(in_srgb,var(--tier0-cta)_40%,transparent)]">
              <Activity size={14} aria-hidden />
            </span>
            {!collapsed ? (
              <div className="min-w-0 flex-1 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]">
                <p className="truncate whitespace-nowrap text-sm font-semibold tracking-tight" title={APP_NAME}>
                  {APP_NAME}
                </p>
                <p className="truncate whitespace-nowrap text-xs text-muted-foreground">
                  业务验收
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-transparent",
              "text-muted-foreground transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              "hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tier0-cta)]/40 active:scale-95",
              collapsed && !onNavigate ? "" : "ml-auto",
            )}
          >
            {collapsed ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronLeft className="size-4" aria-hidden />
            )}
          </button>
        ) : null}

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

      <nav className="flex flex-1 flex-col gap-3 overflow-auto overscroll-contain px-2 pb-4 pt-4">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="relative mb-1 h-5" aria-hidden={collapsed}>
              <p
                className={cn(
                  "absolute inset-0 truncate whitespace-nowrap px-2 text-xs font-medium leading-5 text-muted-foreground",
                  "transition-opacity duration-200",
                  railEase,
                  collapsed ? "opacity-0" : "opacity-100",
                )}
              >
                {group.title}
              </p>
              <span
                className={cn(
                  "absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border",
                  "transition-opacity duration-200",
                  railEase,
                  collapsed ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ key, label, icon: Icon }) => {
                const current = key === active;
                return (
                  <li key={key}>
                    <span
                      aria-current={current ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      aria-label={collapsed ? label : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 overflow-hidden rounded-[4px] pl-4 pr-2 text-sm font-medium",
                        "transition-colors duration-200",
                        railEase,
                        current
                          ? "bg-fill-active text-foreground"
                          : "text-secondary-foreground",
                      )}
                    >
                      <Icon
                        size={16}
                        className="shrink-0 opacity-70 transition-transform duration-200 group-hover:scale-105"
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "truncate whitespace-nowrap transition-[max-width,opacity,transform] duration-200",
                          railEase,
                          collapsed
                            ? "max-w-0 -translate-x-1 opacity-0"
                            : "max-w-[9rem] translate-x-0 opacity-100",
                        )}
                        aria-hidden={collapsed}
                      >
                        {label}
                      </span>
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
  const [collapsed, setCollapsed] = useState(false);
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
    // Same frame as the app Shell: one viewport high, only <main> scrolls (the rail stays put).
    <div data-scene-shell className="flex h-dvh min-h-0 min-w-0 overflow-hidden bg-background">
      <div className="hidden md:flex">
        <SceneNav
          active={active}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />
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
              className="h-full overflow-hidden rounded-[4px] border border-sidebar-border shadow-lg"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 bg-card px-3 md:hidden">
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
            <p className="truncate text-sm font-semibold" title={activeLabel}>{activeLabel}</p>
            <p className="truncate text-xs text-muted-foreground" title={APP_NAME}>{APP_NAME}</p>
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
