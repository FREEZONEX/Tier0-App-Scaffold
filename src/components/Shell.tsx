"use client";

import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, type ElementType } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl, cn } from "@/lib/utils";
import type { AppUser } from "@/lib/users";

export interface NavModule {
  key: string;
  label: string;
  href: string;
  icon?: ElementType;
}

// ─── Agent: add workspace modules only; station/review task flows stay out ───
export const defaultModules: NavModule[] = [
  { key: "dashboard", label: "Overview", href: "/", icon: LayoutDashboard },
];

const COLLAPSED_STORAGE_KEY = "tier0-shell-collapsed";

export function Shell({
  modules = defaultModules,
  user,
  children,
}: {
  modules?: NavModule[];
  user?: AppUser | null;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  async function handleLogout() {
    // Clears the session cookie. The next request hits start.ts middleware,
    // which re-issues a session from the gateway-supplied role (Mode A) or
    // bounces to /login if the gateway didn't supply one.
    try {
      const res = await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to log out");
        return;
      }
      const redirectTo =
        ((await res.json()) as { redirect?: string }).redirect || "/login";
      window.location.assign(redirectTo);
    } catch {
      toast.error("Network error");
    }
  }

  function renderSidebar(isCollapsed: boolean, showCollapseControl: boolean) {
    return (
      <nav
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out",
          isCollapsed ? "w-16" : "w-60",
        )}
      >
        {/* Brand mark */}
        <div
          className={cn(
            "flex min-h-16 items-center gap-2.5 border-b border-sidebar-border px-3 py-3.5 transition-[padding] duration-200 ease-out",
            isCollapsed ? "justify-center" : "",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground">
            <Factory className="size-4" />
          </div>
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out",
              isCollapsed
                ? "max-w-0 -translate-x-1 opacity-0"
                : "max-w-40 translate-x-0 opacity-100",
            )}
            aria-hidden={isCollapsed}
          >
            <p className="truncate text-sm font-semibold leading-5">
              Application
            </p>
            <p className="caption truncate">Workspace</p>
          </div>
        </div>

        {showCollapseControl && (
          <div className="border-b border-sidebar-border p-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "inline-flex h-9 w-full items-center rounded-sm border border-border bg-card text-sm font-medium text-secondary-foreground transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-border-strong hover:bg-muted hover:text-foreground focus:border-highlight focus:outline-none",
                isCollapsed ? "justify-center px-2" : "justify-start gap-2 px-2.5",
              )}
            >
              <span className="grid size-4 shrink-0 place-items-center">
                {isCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </span>
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out",
                  isCollapsed
                    ? "max-w-0 -translate-x-1 opacity-0"
                    : "max-w-24 translate-x-0 opacity-100",
                )}
                aria-hidden={isCollapsed}
              >
                Collapse
              </span>
            </button>
          </div>
        )}

        {/* Modules */}
        <div className="flex-1 overflow-y-auto px-2 py-2.5">
          <p
            className={cn(
              "overflow-hidden px-2 pb-2 pt-1 font-mono text-xs font-medium uppercase text-muted-foreground transition-[max-height,opacity] duration-200 ease-out",
              isCollapsed ? "max-h-0 opacity-0" : "max-h-8 opacity-100",
            )}
            aria-hidden={isCollapsed}
          >
            Modules
          </p>
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.key}
                // `as never`: defaultModules is mutated by the Agent at build time,
                // so the router-typed `to` prop cannot statically know the routes
                // an agent will introduce. Type-safety is preserved everywhere
                // else Link is used directly.
                to={mod.href as never}
                activeOptions={{ exact: mod.href === "/" }}
                title={isCollapsed ? mod.label : undefined}
                aria-label={isCollapsed ? mod.label : undefined}
                className={cn(
                  "group mb-1 flex min-h-10 items-center rounded-sm border border-transparent text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus:border-highlight focus:outline-none",
                  isCollapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                )}
                activeProps={{
                  className:
                    "border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground shadow-sm",
                }}
                inactiveProps={{
                  className:
                    "text-secondary-foreground hover:border-border-strong hover:bg-sidebar-accent hover:text-foreground",
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
              </Link>
            );
          })}
        </div>

        {/* User block */}
        <div
          className={cn(
            "border-t border-sidebar-border bg-card px-3 py-3 transition-[padding] duration-200 ease-out",
            isCollapsed ? "text-center" : "",
          )}
        >
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-[max-height,opacity,transform,margin] duration-200 ease-out",
              isCollapsed
                ? "mb-0 max-h-0 translate-y-1 opacity-0"
                : "mb-2.5 max-h-12 translate-y-0 opacity-100",
            )}
            aria-hidden={isCollapsed}
          >
            <p className="truncate text-sm font-medium leading-5">
              {user?.displayName ?? "Loading"}
            </p>
            <p className="mt-0.5 font-mono text-xs uppercase text-muted-foreground">
              {user?.role ?? ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Logout"
            title={isCollapsed ? "Logout" : undefined}
            className={cn(
              "inline-flex h-9 w-full items-center rounded-sm border border-border bg-background text-sm font-medium text-secondary-foreground transition-[background-color,border-color,color] duration-150 hover:border-border-strong hover:bg-muted hover:text-foreground focus:border-highlight focus:outline-none",
              isCollapsed ? "justify-center px-2" : "justify-start gap-2 px-2.5",
            )}
          >
            <LogOut className="size-4 shrink-0" />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out",
                isCollapsed
                  ? "max-w-0 -translate-x-1 opacity-0"
                  : "max-w-24 translate-x-0 opacity-100",
              )}
              aria-hidden={isCollapsed}
            >
              Logout
            </span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden md:block">{renderSidebar(collapsed, true)}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-primary/35"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-64 shadow-lg">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
            {renderSidebar(false, false)}
          </div>
        </div>
      )}

      <main className="page-y-scroll min-h-0 min-w-0 flex-1">
        <div className="flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-foreground"
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
