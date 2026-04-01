"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";

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
  children,
}: {
  modules?: NavModule[];
  children: ReactNode;
}) {
  const pathname = usePathname();

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
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                {Icon && <Icon className="size-4 shrink-0" />}
                <span>{mod.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Agent: show current user (displayName + role badge) and a logout button here */}
        <div className="border-t border-border px-4 py-3">
          <p className="text-[10px] text-muted-foreground">MES v1.0</p>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
