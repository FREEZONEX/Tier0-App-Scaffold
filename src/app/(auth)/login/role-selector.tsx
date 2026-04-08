"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/utils";

export function RoleSelector({
  roles,
  redirectTo,
}: {
  roles: string[];
  redirectTo: string;
}) {
  const router = useRouter();
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
      router.push(redirectTo);
    } catch {
      setError("Network error");
      setLoading(null);
    }
  }

  if (roles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No roles defined. Add roles to PERMISSION_MATRIX in permissions.ts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => selectRole(role)}
            disabled={loading !== null}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[var(--accent)] hover:text-foreground disabled:opacity-50"
          >
            <span className="capitalize">{role}</span>
            {loading === role && (
              <span className="text-xs text-muted-foreground">...</span>
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
