"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { apiUrl } from "@/lib/utils";
import type { RoleMetadata } from "@/lib/role-metadata";

export type RoleSelectorRole = RoleMetadata & { key: string };

export function RoleSelector({
  roles,
  redirectTo,
}: {
  roles: RoleSelectorRole[];
  redirectTo: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function selectRole(role: RoleSelectorRole) {
    setLoading(role.key);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/select-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role.key }),
      });
      if (!res.ok) {
        setError("当前入口不可用。");
        setLoading(null);
        return;
      }
      const targetPath =
        redirectTo === "/" ? role.defaultRoute : redirectTo;
      window.location.assign(normalizeRedirectPath(targetPath));
    } catch {
      setError("网络异常，请稍后重试。");
      setLoading(null);
    }
  }

  if (roles.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm leading-6 text-muted-foreground">
        当前未配置可用入口。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {roles.map((role) => (
          <button
            type="button"
            key={role.key}
            onClick={() => selectRole(role)}
            disabled={loading !== null}
            className="group flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-left shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:shadow-md focus:border-highlight focus:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {role.label}
              </span>
            </span>
            {loading === role.key ? (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                处理中
              </span>
            ) : (
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="rounded-md border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg">
          {error}
        </p>
      )}
    </div>
  );
}

function normalizeRedirectPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}
