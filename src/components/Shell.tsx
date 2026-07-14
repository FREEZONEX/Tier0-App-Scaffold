"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/users";
import { APP_NAME, filterSidebarModules } from "@/lib/app-chrome";
import { getRoleMetadata } from "@/lib/role-metadata";
import {
  defaultModules,
  filterVisibleModules,
  type NavModule,
} from "./shell-modules";

const COLLAPSED_STORAGE_KEY = "tier0-shell-collapsed";
const COLLAPSED_STORAGE_EVENT = "tier0-shell-collapsed-change";

const sidebarItemBase =
  "group flex items-center rounded-sm border text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-highlight/30";
const sidebarItemActive =
  "border-border bg-highlight-bg-accent text-accent-foreground shadow-sm";
const sidebarItemInactive =
  "border-transparent text-secondary-foreground hover:border-border-secondary hover:bg-sidebar-accent/70 hover:text-foreground";

function normalizeMenuPath(value: string): string {
  if (!value) {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash === "/"
    ? "/"
    : withLeadingSlash.replace(/\/+$/, "");
}

function isMenuHrefActive(href: string, pathname: string): boolean {
  const normalizedHref = normalizeMenuPath(href);
  const normalizedPathname = normalizeMenuPath(pathname);

  if (normalizedHref === "/") {
    return normalizedPathname === "/";
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function collectActiveCandidates(
  modules: NavModule[],
  pathname: string,
  candidates: Array<{ key: string; href: string; order: number }> = [],
): Array<{ key: string; href: string; order: number }> {
  for (const module of modules) {
    if (module.href && isMenuHrefActive(module.href, pathname)) {
      candidates.push({
        key: module.key,
        href: normalizeMenuPath(module.href),
        order: candidates.length,
      });
    }

    if (module.children?.length) {
      collectActiveCandidates(module.children, pathname, candidates);
    }
  }

  return candidates;
}

function getActiveModuleKey(
  modules: NavModule[],
  pathname: string,
): string | undefined {
  return collectActiveCandidates(modules, pathname).sort((a, b) => {
    if (a.href.length !== b.href.length) {
      return b.href.length - a.href.length;
    }

    return a.order - b.order;
  })[0]?.key;
}

function isModuleInActiveBranch(
  module: NavModule,
  activeModuleKey: string | undefined,
): boolean {
  if (!activeModuleKey) {
    return false;
  }

  return (
    module.key === activeModuleKey ||
    (module.children?.some((child) =>
      isModuleInActiveBranch(child, activeModuleKey),
    ) ??
      false)
  );
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
  const activeModuleKey = getActiveModuleKey(sidebarModules, pathname);
  const roleLabel = user?.role ? getRoleMetadata(user.role).label : "Loading";
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
              <p
                className="line-clamp-2 break-words text-sm font-semibold leading-5"
                title={APP_NAME}
              >
                {APP_NAME}
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
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
                  aria-label="Close navigation"
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
            const isDirectActive = mod.key === activeModuleKey;
            const hasActiveDescendant =
              mod.children?.some((child) =>
                isModuleInActiveBranch(child, activeModuleKey),
              ) ??
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
                    aria-current={isDirectActive ? "page" : undefined}
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
                        const isChildActive = child.key === activeModuleKey;

                        return (
                          <Link
                            key={child.key}
                            to={child.href as never}
                            activeOptions={{ exact: true }}
                            title={childTitle}
                            aria-disabled={child.locked || undefined}
                            aria-current={isChildActive ? "page" : undefined}
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
                              isChildActive
                                ? sidebarItemActive
                                : sidebarItemInactive,
                              child.locked ? "opacity-70" : "",
                            )}
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
                activeOptions={{ exact: true }}
                title={
                  isCollapsed
                    ? (mod.disabledReason ?? mod.label)
                    : mod.disabledReason
                }
                aria-label={isCollapsed ? mod.label : undefined}
                aria-disabled={mod.locked || undefined}
                aria-current={isDirectActive ? "page" : undefined}
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
        {!isCollapsed && (
          <div className="border-t border-sidebar-border bg-sidebar px-3 py-3">
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-sm font-medium leading-5">
                {user?.displayName ?? "Loading"}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs uppercase leading-4 text-muted-foreground">
                {roleLabel}
              </p>
            </div>
          </div>
        )}
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
            aria-label="Close navigation"
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
            aria-label="Open navigation"
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
