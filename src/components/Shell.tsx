"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, type ElementType, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Factory,
  Package,
  Cpu,
  ClipboardList,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import { cn, apiUrl } from "@/lib/utils";

export interface NavModule {
  key: string;
  label: string;
  href: string;
  icon?: ElementType;
}

export const defaultModules: NavModule[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { key: "work-centers", label: "Work Centers", href: "/work-centers", icon: Factory },
  { key: "items", label: "Items", href: "/items", icon: Package },
  { key: "equipment", label: "Equipment", href: "/equipment", icon: Cpu },
  { key: "work-orders", label: "Work Orders", href: "/work-orders", icon: ClipboardList },
  { key: "quality", label: "Quality", href: "/quality", icon: ShieldCheck },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: Boxes },
];

interface UserInfo {
  displayName: string;
  role: string;
}

function useCurrentUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  useEffect(() => {
    fetch(apiUrl("/api/auth/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  return user;
}

export function Shell({
  modules = defaultModules,
  children,
}: {
  modules?: NavModule[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();

  async function handleLogout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    router.push("/login");
  }

  function handleSwitchRole() {
    fetch(apiUrl("/api/auth/logout"), { method: "POST" }).then(() => {
      router.push("/login");
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
                href={mod.href}
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

        <div className="space-y-2 border-t border-border px-4 py-3">
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{user.displayName}</p>
                <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {user.role}
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSwitchRole}
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Switch Role
            </button>
            <span className="text-[10px] text-muted-foreground">·</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
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
