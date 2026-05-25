"use client";

import { Link } from "@tanstack/react-router";
import { type ReactNode, type ElementType } from "react";
import { Factory, LayoutDashboard, LogOut } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AppUser } from "@/lib/users";

export interface NavModule {
  key: string;
  label: string;
  href: string;
  icon?: ElementType;
}

// ─── Agent: update this array with your app's modules and lucide-react icons ───
export const defaultModules: NavModule[] = [
  { key: "dashboard", label: "Overview", href: "/", icon: LayoutDashboard },
];

export function Shell({
  modules = defaultModules,
  user,
  children,
}: {
  modules?: NavModule[];
  user?: AppUser | null;
  children: ReactNode;
}) {
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

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <nav className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        {/* Brand mark */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex size-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Factory className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              Industrial App
            </p>
            <p className="caption truncate">Industrial workspace</p>
          </div>
        </div>

        {/* Modules */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="px-2 pb-1.5 pt-1 font-mono text-[10px] font-medium uppercase text-muted-foreground">
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
                className="mb-0.5 flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-sm font-medium transition-colors"
                activeProps={{
                  className:
                    "border-[var(--tier0-highlight-bg-primary)] bg-highlight-bg-accent text-foreground",
                }}
                inactiveProps={{
                  className:
                    "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
                }}
              >
                {Icon && <Icon className="size-4 shrink-0" />}
                <span className="truncate">{mod.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User block */}
        <div className="border-t border-border bg-surface-inset px-3 py-3">
          <div className="mb-2 min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {user?.displayName ?? "Loading"}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {user?.role ?? ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3" />
            Logout
          </Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
