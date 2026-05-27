"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { apiUrl } from "@/lib/utils";

export function RoleSelector({
  roles,
  redirectTo,
}: {
  roles: string[];
  redirectTo: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function selectRole(role: string) {
    setLoading(role);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/select-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to select role");
        setLoading(null);
        return;
      }
      window.location.assign(normalizeRedirectPath(redirectTo));
    } catch {
      setError("Network error");
      setLoading(null);
    }
  }

  if (roles.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm leading-6 text-muted-foreground">
        No roles defined. Add roles to{" "}
        <code className="font-mono">PERMISSION_MATRIX</code> in{" "}
        <code className="font-mono">src/lib/permissions.ts</code>.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => selectRole(role)}
            disabled={loading !== null}
            className="group flex min-h-11 items-center justify-between rounded-md border border-border bg-card px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface-inset disabled:opacity-50"
          >
            <span className="capitalize">{role}</span>
            {loading === role ? (
              <span className="font-mono text-xs text-muted-foreground">
                ...
              </span>
            ) : (
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
