"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import {
  createElement,
  isValidElement,
  useState,
  useSyncExternalStore,
  type ElementType,
  type ReactNode,
} from "react";
import {
  Bell,
  ExternalLink,
  icons,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Popover } from "@/components/kit/ui/popover";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/users";
import { APP_ICON, APP_NAME, filterSidebarModules } from "@/lib/app-chrome";
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
  "group flex items-center rounded-[4px] text-sm font-normal transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar";
const sidebarItemActive =
  "bg-muted text-foreground";
const sidebarItemInactive =
  "text-sidebar-foreground hover:bg-sidebar-accent";
const sidebarIconButton =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

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
 * Sidebar icons come from lucide-react. Prefer a component import; a PascalCase
 * / kebab-case name string is looked up in lucide's `icons` map. Anything else
 * falls through to the letter mark so the collapsed rail stays identifiable.
 */
function normalizeLucideIconName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (Object.prototype.hasOwnProperty.call(icons, trimmed)) return trimmed;
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed;
  return trimmed
    .split(/[-_\s./]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function isLucideIconComponent(value: unknown): value is LucideIcon {
  return (
    typeof value === "function" ||
    (Boolean(value) &&
      typeof value === "object" &&
      "$$typeof" in (value as object) &&
      !isValidElement(value))
  );
}

function resolveNavIcon(icon: unknown): ElementType | null {
  if (isLucideIconComponent(icon)) return icon;
  if (typeof icon === "string") {
    const name = normalizeLucideIconName(icon);
    const matched = name
      ? icons[name as keyof typeof icons]
      : undefined;
    if (isLucideIconComponent(matched)) return matched;
  }
  return null;
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
  const component = resolveNavIcon(icon);
  if (component) {
    return createElement(component, {
      "aria-hidden": true,
      className: cn(className, "shrink-0"),
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

  function toggleCollapsed() {
    setStoredCollapsed(!collapsed);
  }

  function renderLeafBadges(item: NavModule) {
    return (
      <>
        {item.badge ? (
          <span className="ml-auto shrink-0 rounded-[4px] border border-sidebar-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
            {item.badge}
          </span>
        ) : null}
        {item.locked ? (
          <Lock className={cn("size-3.5 shrink-0 text-muted-foreground", item.badge ? "" : "ml-auto")} />
        ) : null}
        {item.newTab && !item.locked ? (
          <ExternalLink
            aria-hidden="true"
            className={cn("size-3.5 shrink-0 text-muted-foreground", item.badge ? "" : "ml-auto")}
          />
        ) : null}
      </>
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
    const itemLayout = isCollapsed ? "justify-center px-0" : "gap-2 overflow-hidden px-2";

    return (
      <nav
        className={cn(
          // Selection inside the rail is one step darker than the gray rail itself.
          "flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground [--muted:var(--sidebar-selected)] transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          showCloseControl
            ? "w-full overflow-hidden rounded-[4px] border border-sidebar-border shadow-lg"
            : "border-r border-sidebar-border",
          !showCloseControl && isCollapsed ? "w-16" : "",
          !showCloseControl && !isCollapsed ? "w-60" : "",
        )}
      >
        {/* Brand row */}
        <div
          className={cn(
            "flex min-h-14 items-center overflow-hidden px-3 py-3",
            showBrandIdentity ? "gap-2" : "justify-center",
          )}
        >
          {showBrandIdentity && (
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px]">
              <img
                src={APP_ICON}
                alt={`${APP_NAME} icon`}
                className="size-full rounded-[inherit] object-cover dark:opacity-90"
              />
            </div>
          )}
          {showBrandIdentity && (
            <p
              className={cn(
                "truncate text-sm font-semibold leading-5 animate-in fade-in-0 duration-200",
                // The desktop rail animates its width: keep the expanded name width so it never reflows mid-transition.
                showCloseControl ? "min-w-0 flex-1" : "w-[126px] shrink-0",
              )}
              title={APP_NAME}
            >
              {APP_NAME}
            </p>
          )}
          {showCollapseControl && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
              title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
              className={cn(sidebarIconButton, "size-8", isCollapsed ? "" : "ml-auto")}
            >
              {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          )}
          {showCloseControl && (
            <button
              type="button"
              aria-label="Close navigation"
              className={cn(sidebarIconButton, "size-8", "ml-auto")}
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Modules: top-level links, then titled sections */}
        <div className={cn("flex-1 overflow-y-auto pb-3 pt-1", isCollapsed ? "px-2" : "px-3")}>
          {sidebarModules.map((mod, index) => {
            const isDirectActive = mod.key === activeModuleKey;

            if (mod.children?.length) {
              return (
                <div key={mod.key} role="group" aria-label={mod.label} className={index === 0 ? "" : "mt-4"}>
                  {isCollapsed ? (
                    <div aria-hidden="true" className="mx-1 mb-2 border-t border-sidebar-border" />
                  ) : (
                    <p
                      className={cn(
                        "flex items-center gap-1.5 px-2 pb-1.5 text-xs leading-4",
                        isModuleInActiveBranch(mod, activeModuleKey) ? "text-secondary-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">{mod.label}</span>
                      {mod.locked ? <Lock className="size-3 shrink-0" /> : null}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {mod.children.map((child) => {
                      const childTitle = child.disabledReason ?? child.label;
                      const isChildActive = child.key === activeModuleKey;
                      const locked = child.locked || mod.locked;

                      return (
                        <Tooltip key={child.key} title={childTitle} disabled={!isCollapsed} placement="right" anchorClassName="flex w-full">
                          <Link
                            to={child.href as never}
                            // router-core 1.171.14: https://github.com/TanStack/router/issues/7759
                            preload={false}
                            activeOptions={{ exact: true }}
                            target={child.newTab ? "_blank" : undefined}
                            rel={child.newTab ? "noreferrer" : undefined}
                            title={isCollapsed ? undefined : child.disabledReason}
                            aria-label={isCollapsed ? child.label : undefined}
                            aria-disabled={locked || undefined}
                            aria-current={isChildActive ? "page" : undefined}
                            onClick={(event) => {
                              if (locked) {
                                event.preventDefault();
                                return;
                              }
                              setMobileOpen(false);
                            }}
                            className={cn(
                              sidebarItemBase,
                              "min-h-9 w-full",
                              isChildActive ? sidebarItemActive : sidebarItemInactive,
                              locked ? "opacity-60" : "",
                              itemLayout,
                            )}
                          >
                            <NavIcon icon={child.icon} label={child.label} className="size-4" />
                            {!isCollapsed ? (
                              <>
                                <span className="min-w-0 truncate whitespace-nowrap">{child.label}</span>
                                {renderLeafBadges(child)}
                              </>
                            ) : null}
                          </Link>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <Tooltip key={mod.key} title={mod.disabledReason ?? mod.label} disabled={!isCollapsed} placement="right" anchorClassName="flex w-full">
                <Link
                  // `as never`: defaultModules is mutated by the Agent at build time,
                  // so the router-typed `to` prop cannot statically know the routes
                  // an agent will introduce. Type-safety is preserved everywhere
                  // else Link is used directly.
                  to={mod.href as never}
                  // router-core 1.171.14: https://github.com/TanStack/router/issues/7759
                  preload={false}
                  activeOptions={{ exact: true }}
                  target={mod.newTab ? "_blank" : undefined}
                  rel={mod.newTab ? "noreferrer" : undefined}
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
                    "mb-0.5 min-h-9 w-full",
                    isDirectActive ? sidebarItemActive : sidebarItemInactive,
                    mod.locked ? "opacity-60" : "",
                    itemLayout,
                  )}
                >
                  <NavIcon icon={mod.icon} label={mod.label} className="size-4" />
                  {!isCollapsed ? (
                    <>
                      <span className="min-w-0 truncate whitespace-nowrap">{mod.label}</span>
                      {renderLeafBadges(mod)}
                    </>
                  ) : null}
                </Link>
              </Tooltip>
            );
          })}
        </div>

        {/* Notifications + account — always at the bottom of the rail. */}
        <div className={cn("shrink-0 py-3", isCollapsed ? "px-2" : "px-3")}>
          <div
            className={cn(
              "flex min-w-0 items-center overflow-hidden border-t border-sidebar-border pt-3",
              isCollapsed ? "flex-col gap-2" : "gap-1",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center overflow-hidden",
                isCollapsed ? "justify-center" : "min-w-0 flex-1 gap-2.5 px-1",
              )}
            >
              <span
                aria-hidden="true"
                title={isCollapsed ? user?.displayName : undefined}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
              >
                <User className="size-4" />
              </span>
              <div className={isCollapsed ? "sr-only" : "min-w-0 flex-1 overflow-hidden"}>
                <p className="truncate text-sm leading-5" title={user?.displayName}>
                  {user?.displayName ?? "…"}
                </p>
                <p className="truncate text-xs leading-4 text-muted-foreground" title={roleLabel || undefined}>
                  {roleLabel || "未分配角色"}
                </p>
              </div>
            </div>
            <Popover
              placement="top-end"
              aria-label="通知"
              title="通知"
              content={<p className="text-xs text-muted-foreground">暂无新通知</p>}
            >
              <button
                type="button"
                aria-label="通知"
                title="通知"
                className={cn(sidebarIconButton, "size-8")}
              >
                <Bell className="size-4" aria-hidden />
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
            aria-label="Close navigation"
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
        <div className="flex h-14 items-center bg-card px-4 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="inline-flex size-10 items-center justify-center rounded-[4px] border border-border bg-card text-foreground shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:border-border-strong hover:bg-background hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/35 active:scale-95"
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
