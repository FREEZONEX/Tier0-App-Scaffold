"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, type ElementType } from "react";
import { cn, apiUrl } from "@/lib/utils";
import type { AppUser } from "@/lib/users";

export interface NavModule {
  key: string;
  label: string;
  href: string;
  icon?: ElementType;
}

// ─── Agent: update this array with your app's modules and lucide-react icons ───
export const defaultModules: NavModule[] = [
  { key: "dashboard", label: "Dashboard", href: "/" },
];

export function Shell({
  modules = defaultModules,
  user,
  children,
}: {
  modules?: NavModule[];
  user: AppUser;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function handleLogout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    navigate({ to: "/login" });
  }

  function handleSwitchRole() {
    fetch(apiUrl("/api/auth/logout"), { method: "POST" }).then(() => {
      navigate({ to: "/login" });
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-4 py-5">
          <h1 className="text-sm font-semibold tracking-tight">Shop Floor</h1>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Command
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {modules.map((mod) => {
            const isActive =
              pathname === mod.href ||
              (mod.href !== "/" && pathname.startsWith(mod.href));
            const Icon = mod.icon;
            return (
              <Link
                key={mod.key}
                // `as never`: defaultModules is mutated by the Agent at build time,
                // so the router-typed `to` prop cannot statically know the routes
                // an agent will introduce. Type-safety is preserved everywhere
                // else Link is used directly.
                to={mod.href as never}
                className={cn(
                  "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[var(--accent)] text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                {Icon && <Icon className="size-4 shrink-0" />}
                <span>{mod.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{user.displayName}</p>
              <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {user.role}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSwitchRole}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Switch Role
            </button>
            <span className="text-[10px] text-muted-foreground">·</span>
            <button
              onClick={handleLogout}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
