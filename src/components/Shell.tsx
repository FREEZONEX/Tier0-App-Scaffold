"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import {
  createElement,
  useState,
  useSyncExternalStore,
  type ElementType,
  type ReactNode,
} from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { Popover } from "@/components/kit/ui/popover";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/users";
import { APP_ICON, APP_NAME, filterSidebarModules, uiText } from "@/lib/app-chrome";
import { resolveNavIconComponent } from "./nav-icons";
import { getRoleMetadata } from "@/lib/role-metadata";
import {
  defaultModules,
  filterVisibleModules,
  type NavModule,
  validateNavigationModules,
} from "./shell-modules";

const COLLAPSED_STORAGE_KEY = "tier0-shell-collapsed";
const COLLAPSED_STORAGE_EVENT = "tier0-shell-collapsed-change";

const sidebarItemBase =
  "group flex items-center rounded-[4px] text-sm font-medium pointer-coarse:min-h-11 transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar";
const sidebarItemActive =
  "bg-muted text-foreground";
// Hover is a lighter fill than the selection, so hovering never looks like the current page.
const sidebarItemInactive =
  "text-secondary-foreground hover:bg-muted/50 hover:text-foreground active:translate-x-px";
const sidebarIconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

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

/**
 * Sidebar icons: a lucide component import, a name from the curated
 * `NAV_ICON_LIBRARY`, or — when neither is given or usable — an icon matched
 * from the label (「报修单」→ Wrench). See `./nav-icons`. Anything else falls
 * through to the letter mark, so the collapsed rail never shows an empty entry.
 */
function resolveNavIcon(icon: unknown, label: string): ElementType | null {
  return resolveNavIconComponent(icon, label);
}

/** Collapsed-rail tooltip: the name, plus why the entry is locked. */
function navTitle(module: NavModule): string {
  return module.disabledReason ? `${module.label}：${module.disabledReason}` : module.label;
}

function NavIcon({
  icon,
  label,
  className,
}: {
  icon: unknown;
  label: string;
  className: string;
}) {
  const component = resolveNavIcon(icon, label);
  if (component) {
    return createElement(component, {
      "aria-hidden": true,
      className: cn(className, "shrink-0 transition-transform duration-200 group-hover:scale-105"),
    });
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        className,
        "inline-flex shrink-0 items-center justify-center rounded-[3px] border border-current text-[10px] font-semibold leading-none",
      )}
    >
      {Array.from(label.trim())[0] ?? "·"}
    </span>
  );
}

export function Shell({
  modules = defaultModules,
  user,
  children,
  /** Gallery / chrome demos: render only the collapsible sidebar rail. */
  sidebarOnly = false,
}: {
  modules?: NavModule[];
  user?: AppUser | null;
  children?: ReactNode;
  sidebarOnly?: boolean;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  validateNavigationModules(modules);
  const sidebarModules = filterVisibleModules(
    filterSidebarModules(modules),
    user?.roles,
  );
  const activeModuleKey = getActiveModuleKey(sidebarModules, pathname);
  const assignedRoles = user?.roles ?? [];
  const roleLabel = assignedRoles
    .map((role) => getRoleMetadata(role).label)
    .join(" · ");
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  /** Collapsed rail: the group whose children are shown in a flyout beside it. */
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);

  function toggleCollapsed() {
    setStoredCollapsed(!collapsed);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  /** One child entry; used by the expanded group list and by the collapsed-rail flyout. */
  function renderChildLink(child: NavModule, onNavigate: () => void) {
    const childTitle = navTitle(child);
    const isChildActive = child.key === activeModuleKey;

    return (
      <Link
        key={child.key}
        to={child.href as never}
        // router-core 1.171.14: https://github.com/TanStack/router/issues/7759
        preload={false}
        activeOptions={{ exact: true }}
        title={childTitle}
        aria-disabled={child.locked || undefined}
        aria-current={isChildActive ? "page" : undefined}
        onClick={(event) => {
          if (child.locked) {
            event.preventDefault();
            return;
          }
          onNavigate();
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
        <NavIcon icon={child.icon} label={child.label} className={cn("size-3.5", isChildActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
        <span className={cn("min-w-0 truncate whitespace-nowrap", isChildActive && "font-semibold")}>
          {child.label}
        </span>
        {child.badge ? (
          <span className="ml-auto shrink-0 rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground">
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
          "flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          showCloseControl
            ? "w-full overflow-hidden rounded-[4px] border border-sidebar-border shadow-lg"
            : "border-r border-sidebar-border",
          !showCloseControl && isCollapsed ? "w-16" : "",
          !showCloseControl && !isCollapsed ? "w-60" : "",
        )}
      >
        {/* Brand mark */}
        <div
          className={cn(
            "flex min-h-14 items-center overflow-hidden px-3 py-2.5 transition-[gap,padding] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            showBrandIdentity ? "gap-3" : "justify-center gap-0",
          )}
        >
          {showBrandIdentity && (
            <div className="flex shrink-0 items-center">
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px]">
                <img
                  src={APP_ICON}
                  alt={`${APP_NAME} icon`}
                  className="size-full rounded-[inherit] object-cover dark:opacity-90"
                />
              </div>
            </div>
          )}
          {!isCollapsed && showBrandIdentity && (
            <div
              className={cn(
                "overflow-hidden animate-in fade-in-0 duration-200",
                // Desktop rail animates its width: lay the name out at the expanded width (w-60 minus icon, button, gaps, padding) so it never reflows mid-transition.
                showCloseControl ? "min-w-0" : "w-[126px] shrink-0",
              )}
            >
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
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? uiText("expandSidebar") : uiText("collapseSidebar")}
                  title={isCollapsed ? uiText("expandSidebar") : uiText("collapseSidebar")}
                  className="inline-flex size-8 items-center justify-center rounded-[4px] border border-transparent bg-transparent text-muted-foreground transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/35 active:scale-95 pointer-coarse:size-11"
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
                  aria-label={uiText("closeNavigation")}
                  className="inline-flex size-8 items-center justify-center rounded-[4px] border border-transparent bg-transparent text-muted-foreground transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/35 active:scale-95 pointer-coarse:size-11"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modules */}
        <div className="flex-1 overflow-y-auto px-2 pb-2.5 pt-4">
          {sidebarModules.map((mod) => {
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
              const groupTitle = navTitle(mod);
              return (
                <div key={mod.key} className="mb-1">
                  <Popover
                    trigger="click"
                    placement="right-start"
                    offset={10}
                    disabled={!isCollapsed || Boolean(mod.locked)}
                    open={isCollapsed && flyoutGroup === mod.key}
                    onOpenChange={(open) => setFlyoutGroup(open ? mod.key : null)}
                    aria-label={mod.label}
                    anchorClassName="flex w-full"
                    className="min-w-48 p-1.5"
                    content={({ close }) => (
                      <div className="flex flex-col gap-0.5">
                        <p className="px-3 pb-1 pt-1 text-xs font-medium text-muted-foreground">{mod.label}</p>
                        {mod.children?.map((child) => renderChildLink(child, close))}
                      </div>
                    )}
                  >
                  <Tooltip title={groupTitle} disabled={!isCollapsed || flyoutGroup === mod.key} placement="right" anchorClassName="flex w-full">
                  <button
                    type="button"
                    aria-expanded={isCollapsed ? flyoutGroup === mod.key : isExpanded}
                    aria-disabled={mod.locked || undefined}
                    aria-current={isDirectActive ? "page" : undefined}
                    title={isCollapsed ? undefined : mod.disabledReason}
                    aria-label={isCollapsed ? mod.label : undefined}
                    onClick={() => {
                      // Collapsed: the surrounding Popover opens the child flyout.
                      if (mod.locked || isCollapsed) {
                        return;
                      }

                      toggleGroup(mod.key);
                    }}
                    className={cn(
                      sidebarItemBase,
                      "min-h-10 w-full",
                      isDirectActive || (hasActiveDescendant && !isExpanded) ? sidebarItemActive : sidebarItemInactive,
                      mod.locked ? "opacity-70" : "",
                      isCollapsed ? "justify-center px-0" : "gap-2.5 overflow-hidden pl-4 pr-3",
                    )}
                  >
                    <NavIcon icon={mod.icon} label={mod.label} className={cn("size-4", isDirectActive || (hasActiveDescendant && !isExpanded) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate whitespace-nowrap text-left transition-[max-width,opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                        isDirectActive || (hasActiveDescendant && !isExpanded) ? "font-semibold" : "",
                        isCollapsed
                          ? "max-w-0 -translate-x-1 opacity-0"
                          : "max-w-36 translate-x-0 opacity-100",
                      )}
                      aria-hidden={isCollapsed}
                    >
                      {mod.label}
                    </span>
                    {!isCollapsed && mod.badge ? (
                      <span className="shrink-0 rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground">
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
                  </Tooltip>
                  </Popover>
                  {!isCollapsed && isExpanded && (
                    <div className="mt-1 space-y-1 pl-6">
                      {mod.children?.map((child) => renderChildLink(child, () => setMobileOpen(false)))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Tooltip key={mod.key} title={navTitle(mod)} disabled={!isCollapsed} placement="right" anchorClassName="flex w-full">
              <Link
                // `as never`: defaultModules is mutated by the Agent at build time,
                // so the router-typed `to` prop cannot statically know the routes
                // an agent will introduce. Type-safety is preserved everywhere
                // else Link is used directly.
                to={mod.href as never}
                // router-core 1.171.14: https://github.com/TanStack/router/issues/7759
                preload={false}
                activeOptions={{ exact: true }}
                title={isCollapsed ? undefined : mod.disabledReason}
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
                  "mb-1 min-h-10 w-full",
                  isDirectActive ? sidebarItemActive : sidebarItemInactive,
                  mod.locked ? "opacity-70" : "",
                  isCollapsed ? "justify-center px-0" : "gap-2.5 overflow-hidden pl-4 pr-3",
                )}
              >
                <NavIcon icon={mod.icon} label={mod.label} className={cn("size-4", isDirectActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span
                  className={cn(
                    "min-w-0 truncate whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                    isDirectActive && "font-semibold",
                    isCollapsed
                      ? "max-w-0 -translate-x-1 opacity-0"
                      : "max-w-40 translate-x-0 opacity-100",
                  )}
                  aria-hidden={isCollapsed}
                >
                  {mod.label}
                </span>
                {!isCollapsed && mod.badge ? (
                  <span className="ml-auto shrink-0 rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground">
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
              </Tooltip>
            );
          })}
        </div>

        {/* Notifications + account — always visible at the bottom of the rail. */}
        <div className={cn("shrink-0 border-t border-sidebar-border bg-sidebar py-3", isCollapsed ? "px-2" : "px-3")}>
          <div className={cn("flex min-w-0 items-center overflow-hidden", isCollapsed ? "flex-col gap-2" : "gap-1")}>
            <div className={cn("flex min-w-0 items-center overflow-hidden", isCollapsed ? "justify-center" : "min-w-0 flex-1 gap-2.5")}>
              <span
                aria-hidden="true"
                title={isCollapsed ? user?.displayName : undefined}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-muted text-xs font-semibold text-foreground"
              >
                {(user?.displayName ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className={isCollapsed ? "sr-only" : "min-w-0 overflow-hidden"}>
                <p className="truncate text-sm font-medium leading-5">
                  {user?.displayName ?? uiText("loading")}
                </p>
                {user ? (
                  <p className="mt-0.5 truncate font-mono text-xs uppercase leading-4 text-muted-foreground" title={roleLabel || undefined}>
                    {roleLabel || uiText("noRoles")}
                  </p>
                ) : null}
              </div>
            </div>
            <Popover
              placement="top-end"
              aria-label="通知"
              title="通知"
              content={<p className="text-xs text-muted-foreground">暂无新通知</p>}
            >
              <button type="button" aria-label="通知" title="通知" className={sidebarIconButton}>
                <Bell className="size-4" aria-hidden="true" />
              </button>
            </Popover>
          </div>
        </div>
      </nav>
    );
  }

  if (sidebarOnly) {
    return (
      <div className="flex h-full min-h-[560px] overflow-hidden rounded-[4px] border border-border bg-background text-foreground shadow-xs">
        {renderSidebar({ isCollapsed: collapsed, showCollapseControl: true })}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <div className="hidden md:block">
        {renderSidebar({ isCollapsed: collapsed, showCollapseControl: true })}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            aria-label={uiText("closeNavigation")}
            className="absolute inset-0 bg-black/40 supports-[backdrop-filter]:bg-black/30 supports-[backdrop-filter]:backdrop-blur-[2px] animate-[tier0-fade_160ms_ease-out]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-full max-w-[min(18rem,calc(100vw-0.75rem))] p-2 animate-[tier0-drawer-left_220ms_var(--motion-ease)]">
            {renderSidebar({
              isCollapsed: false,
              showCollapseControl: false,
              showCloseControl: true,
            })}
          </div>
        </div>
      )}

      <main className="page-y-scroll min-h-0 min-w-0 flex-1">
        <OfflineBanner />
        <div className="flex h-14 items-center bg-card px-4 md:hidden">
          <button
            type="button"
            aria-label={uiText("openNavigation")}
            className="inline-flex size-10 items-center justify-center rounded-[4px] border border-border bg-card pointer-coarse:size-11 text-foreground shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:border-border-strong hover:bg-background hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/35 active:scale-95"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </button>
        </div>
        {/* Operational pages fill the available workspace width. Forms and
            long text may constrain their own content blocks for readability;
            wide tables/boards keep horizontal scrolling inside the page. */}
        <div className="w-full min-w-0">{children}</div>
      </main>
    </div>
  );
}
