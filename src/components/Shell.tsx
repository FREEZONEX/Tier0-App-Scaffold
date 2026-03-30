"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, type ElementType } from "react";

export interface NavModule {
  key: string;
  label: string;
  /** 2-3 letter abbreviation (used as fallback when no icon) */
  short: string;
  href: string;
  /** Optional lucide-react icon component */
  icon?: ElementType;
}

// ─── Agent: update this array with your app's modules ───
export const defaultModules: NavModule[] = [
  { key: "dashboard", label: "Dashboard", short: "KPI", href: "/" },
];

export interface ShellUser {
  displayName: string;
  role: string;
}

export function Shell({
  modules = defaultModules,
  user,
  onSwitchUser,
  children,
}: {
  modules?: NavModule[];
  /** Current logged-in user. Pass undefined to hide user area. */
  user?: ShellUser | null;
  /** Called when "Switch User" is clicked. */
  onSwitchUser?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Left Navigation Rail */}
      <nav className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-gray-50/80">
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
                className={`group mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-black"
                    : "text-gray-600 hover:bg-gray-100 hover:text-black"
                }`}
              >
                {Icon ? (
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                ) : (
                  <span className="w-4 text-center text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {mod.short}
                  </span>
                )}
                <span>{mod.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer: user info + version */}
        <div className="border-t border-[var(--border)] px-4 py-3">
          {user && (
            <div className="mb-2">
              <p className="truncate text-xs font-medium">{user.displayName}</p>
              <p className="text-[10px] text-muted-foreground">{user.role}</p>
              {onSwitchUser && (
                <button
                  onClick={onSwitchUser}
                  className="mt-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  Switch User
                </button>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">MES v1.0</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
