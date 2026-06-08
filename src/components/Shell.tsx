"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import {
  useState,
  useSyncExternalStore,
  type ReactNode,
  type ElementType,
} from "react";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  LayoutDashboard,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/users";
import { ReLoginButton } from "@/components/relogin-button";
import { filterSidebarModules } from "@/lib/app-chrome";
import { getRoleMetadata } from "@/lib/role-metadata";
import { can, type Action } from "@/lib/permissions";

export interface NavModule {
  key: string;
  label: string;
  href?: string;
  icon?: ElementType;
  actions?: Action[];
  children?: NavModule[];
  badge?: string;
  locked?: boolean;
  disabledReason?: string;
}

// ─── Agent: add workspace modules only; station/review task flows stay out ───
export const defaultModules: NavModule[] = [
  {
    key: "dashboard",
    label: "概览",
    href: "/",
    icon: LayoutDashboard,
    actions: ["view_dashboard"],
  },
  {
    key: "uns_connectivity",
    label: "UNS联通",
    href: "/uns-connectivity",
    icon: Activity,
    actions: ["manage_system"],
  },
];

const COLLAPSED_STORAGE_KEY = "tier0-shell-collapsed";
const COLLAPSED_STORAGE_EVENT = "tier0-shell-collapsed-change";

const sidebarItemBase =
  "group flex items-center rounded-sm border text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-highlight/30";
const sidebarItemActive =
  "border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground shadow-sm";
const sidebarItemInactive =
  "border-transparent text-secondary-foreground hover:border-border-secondary hover:bg-sidebar-accent/70 hover:text-foreground";

const MODULE_ACTIONS_BY_KEY: Record<string, Action[]> = {
  dashboard: ["view_dashboard"],
  overview: ["view_dashboard"],
  sales_orders: ["manage_sales_orders"],
  salesOrders: ["manage_sales_orders"],
  order_chain: ["manage_sales_orders"],
  orderChain: ["manage_sales_orders"],
  scheduling: ["manage_scheduling"],
  gantt_scheduling: ["manage_scheduling"],
  ganttScheduling: ["manage_scheduling"],
  kitting: ["manage_kitting"],
  traceability: ["manage_traceability"],
  sn_traceability: ["manage_traceability"],
  snTraceability: ["manage_traceability"],
  master_data: ["manage_master_data"],
  masterData: ["manage_master_data"],
  settings: ["manage_system"],
  system: ["manage_system"],
  system_config: ["manage_system"],
  systemConfig: ["manage_system"],
};

const MODULE_ACTIONS_BY_LABEL: Record<string, Action[]> = {
  总览: ["view_dashboard"],
  订单链路: ["manage_sales_orders"],
  甘特排产: ["manage_scheduling"],
  齐套管理: ["manage_kitting"],
  SN追溯: ["manage_traceability"],
  主数据: ["manage_master_data"],
  系统配置: ["manage_system"],
  设置: ["manage_system"],
};

export function getModuleActions(module: NavModule): Action[] {
  return (
    module.actions ??
    MODULE_ACTIONS_BY_KEY[module.key] ??
    MODULE_ACTIONS_BY_LABEL[module.label] ??
    []
  );
}

export function canViewModule(
  role: string | undefined,
  module: NavModule,
): boolean {
  const actions = getModuleActions(module);
  if (actions.length === 0) {
    return true;
  }
  if (!role) {
    return false;
  }
  return actions.every((action) => can(role, action));
}

function isModuleActive(module: NavModule, pathname: string): boolean {
  if (module.href === pathname) {
    return true;
  }

  return (
    module.children?.some((child) => isModuleActive(child, pathname)) ?? false
  );
}

export function filterVisibleModules(
  modules: NavModule[],
  role: string | undefined,
): NavModule[] {
  return modules.flatMap((module) => {
    const children = module.children
      ? filterVisibleModules(module.children, role)
      : undefined;
    const canViewParent =
      module.href || getModuleActions(module).length > 0
        ? canViewModule(role, module)
        : true;

    if (!canViewParent && !children?.length) {
      return [];
    }

    if (children !== undefined) {
      if (!children.length) {
        return module.href && canViewParent ? [{ ...module, children }] : [];
      }

      return [{ ...module, children }];
    }

    return module.href && canViewParent ? [module] : [];
  });
}

function getCollapsedSnapshot() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
}

function getCollapsedServerSnapshot() {
  return false;
}

function subscribeCollapsed(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", listener);
  window.addEventListener(COLLAPSED_STORAGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(COLLAPSED_STORAGE_EVENT, listener);
  };
}

function setStoredCollapsed(value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COLLAPSED_STORAGE_KEY, String(value));
  window.dispatchEvent(new Event(COLLAPSED_STORAGE_EVENT));
}

export function Shell({
  modules = defaultModules,
  user,
  children,
}: {
  modules?: NavModule[];
  user?: AppUser | null;
  children: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const sidebarModules = filterVisibleModules(
    filterSidebarModules(modules),
    user?.role,
  );
  const roleLabel = user?.role ? getRoleMetadata(user.role).label : "加载中";
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  function toggleCollapsed() {
    setStoredCollapsed(!collapsed);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function expandGroupFromCollapsed(key: string) {
    setStoredCollapsed(false);
    setExpandedGroups((current) => ({
      ...current,
      [key]: true,
    }));
  }

  function renderSidebar({
    isCollapsed,
    showCollapseControl,
    showCloseControl = false,
  }: {
    isCollapsed: boolean;
    showCollapseControl: boolean;
    showCloseControl?: boolean;
  }) {
    const showBrandIdentity = !isCollapsed || showCloseControl;

    return (
      <nav
        className={cn(
          "flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-out",
          showCloseControl
            ? "w-full overflow-hidden rounded-md border border-sidebar-border shadow-lg"
            : "border-r border-sidebar-border",
          !showCloseControl && isCollapsed ? "w-16" : "",
          !showCloseControl && !isCollapsed ? "w-60" : "",
        )}
      >
        {/* Brand mark */}
        <div
          className={cn(
            "flex min-h-14 items-center border-b border-sidebar-border px-3 py-2.5 transition-[gap,padding] duration-200 ease-out",
            showBrandIdentity ? "gap-3" : "justify-center gap-0",
          )}
        >
          {showBrandIdentity && (
            <div className="flex shrink-0 items-center">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground">
                <Factory className="size-4" />
              </div>
            </div>
          )}
          {!isCollapsed && showBrandIdentity && (
            <div className="min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out">
              <p className="truncate text-sm font-semibold leading-5">
                制造应用
              </p>
            </div>
          )}
          {(showCollapseControl || showCloseControl) && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-2",
                isCollapsed ? "" : "ml-auto",
              )}
            >
              {showCollapseControl && (
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
                  title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
                  className="inline-flex size-8 items-center justify-center rounded-sm border border-transparent bg-transparent text-muted-foreground transition-[background-color,color] duration-150 hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-highlight/30"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronLeft className="size-4" />
                  )}
                </button>
              )}
              {showCloseControl && (
                <button
                  type="button"
                  aria-label="关闭导航"
                  className="inline-flex size-8 items-center justify-center rounded-sm border border-transparent bg-transparent text-muted-foreground transition-[background-color,color] duration-150 hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-highlight/30"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modules */}
        <div className="flex-1 overflow-y-auto px-2 py-2.5">
          {sidebarModules.map((mod) => {
            const Icon = mod.icon;
            const hasChildren = Boolean(mod.children?.length);
            const isDirectActive = mod.href === pathname;
            const hasActiveDescendant =
              mod.children?.some((child) => isModuleActive(child, pathname)) ??
              false;
            const isExpanded =
              !isCollapsed &&
              (expandedGroups[mod.key] ??
                (isDirectActive || hasActiveDescendant));

            if (hasChildren) {
              const groupTitle = mod.disabledReason ?? mod.label;
              return (
                <div key={mod.key} className="mb-1">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-disabled={mod.locked || undefined}
                    title={isCollapsed ? groupTitle : mod.disabledReason}
                    aria-label={isCollapsed ? mod.label : undefined}
                    onClick={() => {
                      if (mod.locked) {
                        return;
                      }
                      if (isCollapsed) {
                        expandGroupFromCollapsed(mod.key);
                        return;
                      }

                      toggleGroup(mod.key);
                    }}
                    className={cn(
                      sidebarItemBase,
                      "min-h-10 w-full",
                      isDirectActive ? sidebarItemActive : sidebarItemInactive,
                      mod.locked ? "opacity-70" : "",
                      isCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
                    )}
                  >
                    {Icon && (
                      <Icon className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate whitespace-nowrap text-left transition-[max-width,opacity,transform] duration-200 ease-out",
                        isCollapsed
                          ? "max-w-0 -translate-x-1 opacity-0"
                          : "max-w-36 translate-x-0 opacity-100",
                      )}
                      aria-hidden={isCollapsed}
                    >
                      {mod.label}
                    </span>
                    {!isCollapsed && mod.badge ? (
                      <span className="shrink-0 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                        {mod.badge}
                      </span>
                    ) : null}
                    {!isCollapsed && mod.locked ? (
                      <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    {!isCollapsed && (
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                          isExpanded ? "rotate-180" : "rotate-0",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  {!isCollapsed && isExpanded && (
                    <div className="mt-1 space-y-1 pl-6">
                      {mod.children?.map((child) => {
                        const ChildIcon = child.icon;
                        const childTitle = child.disabledReason ?? child.label;

                        return (
                          <Link
                            key={child.key}
                            to={child.href as never}
                            activeOptions={{ exact: child.href === "/" }}
                            title={childTitle}
                            aria-disabled={child.locked || undefined}
                            onClick={(event) => {
                              if (child.locked) {
                                event.preventDefault();
                                return;
                              }
                              setMobileOpen(false);
                            }}
                            className={cn(
                              sidebarItemBase,
                              "min-h-9 gap-2 px-3",
                              child.locked ? "opacity-70" : "",
                            )}
                            activeProps={{
                              className: sidebarItemActive,
                            }}
                            inactiveProps={{
                              className: sidebarItemInactive,
                            }}
                          >
                            {ChildIcon && (
                              <ChildIcon className="size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                            )}
                            <span className="min-w-0 truncate whitespace-nowrap">
                              {child.label}
                            </span>
                            {child.badge ? (
                              <span className="ml-auto shrink-0 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                                {child.badge}
                              </span>
                            ) : null}
                            {child.locked ? (
                              <Lock
                                className={cn(
                                  "size-3.5 shrink-0 text-muted-foreground",
                                  child.badge ? "" : "ml-auto",
                                )}
                              />
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={mod.key}
                // `as never`: defaultModules is mutated by the Agent at build time,
                // so the router-typed `to` prop cannot statically know the routes
                // an agent will introduce. Type-safety is preserved everywhere
                // else Link is used directly.
                to={mod.href as never}
                activeOptions={{ exact: mod.href === "/" }}
                title={
                  isCollapsed
                    ? (mod.disabledReason ?? mod.label)
                    : mod.disabledReason
                }
                aria-label={isCollapsed ? mod.label : undefined}
                aria-disabled={mod.locked || undefined}
                onClick={(event) => {
                  if (mod.locked) {
                    event.preventDefault();
                    return;
                  }
                  setMobileOpen(false);
                }}
                className={cn(
                  sidebarItemBase,
                  "mb-1 min-h-10",
                  mod.locked ? "opacity-70" : "",
                  isCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
                )}
                activeProps={{
                  className: sidebarItemActive,
                }}
                inactiveProps={{
                  className: sidebarItemInactive,
                }}
              >
                {Icon && (
                  <Icon className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                )}
                <span
                  className={cn(
                    "min-w-0 truncate whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out",
                    isCollapsed
                      ? "max-w-0 -translate-x-1 opacity-0"
                      : "max-w-40 translate-x-0 opacity-100",
                  )}
                  aria-hidden={isCollapsed}
                >
                  {mod.label}
                </span>
                {!isCollapsed && mod.badge ? (
                  <span className="ml-auto shrink-0 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                    {mod.badge}
                  </span>
                ) : null}
                {!isCollapsed && mod.locked ? (
                  <Lock
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground",
                      mod.badge ? "" : "ml-auto",
                    )}
                  />
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* User block */}
        <div
          className={cn(
            "border-t border-sidebar-border bg-sidebar px-3 py-3 transition-[padding] duration-200 ease-out",
            isCollapsed ? "text-center" : "",
          )}
        >
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-[max-height,opacity,transform,margin] duration-200 ease-out",
              isCollapsed
                ? "mb-0 max-h-0 translate-y-1 opacity-0"
                : "mb-2.5 max-h-16 translate-y-0 opacity-100",
            )}
            aria-hidden={isCollapsed}
          >
            <p className="truncate text-sm font-medium leading-5">
              {user?.displayName ?? "加载中"}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs uppercase leading-4 text-muted-foreground">
              {roleLabel}
            </p>
          </div>
          <ReLoginButton
            iconOnly={isCollapsed}
            className="w-full border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-sidebar-accent hover:shadow-none"
          />
        </div>
      </nav>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden md:block">
        {renderSidebar({ isCollapsed: collapsed, showCollapseControl: true })}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            aria-label="关闭导航"
            className="absolute inset-0 bg-primary/35"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-full max-w-[min(18rem,calc(100vw-0.75rem))] p-2">
            {renderSidebar({
              isCollapsed: false,
              showCollapseControl: false,
              showCloseControl: true,
            })}
          </div>
        </div>
      )}

      <main className="page-y-scroll min-h-0 min-w-0 flex-1">
        <div className="flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
          <button
            type="button"
            aria-label="打开导航"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:shadow-md focus:border-highlight focus:outline-none"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
