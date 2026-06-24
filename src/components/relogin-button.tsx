"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { apiUrl, cn } from "@/lib/utils";

export function ReLoginButton({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleRelogin() {
    if (pending) return;

    setPending(true);
    try {
      const res = await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
      if (!res.ok) {
        toast.error("退出登录失败");
        setPending(false);
        return;
      }
      const redirectTo =
        ((await res.json()) as { redirect?: string }).redirect || "/login";
      window.location.assign(redirectTo);
    } catch {
      toast.error("网络异常");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRelogin}
      disabled={pending}
      aria-busy={pending}
      aria-label="退出登录"
      title={iconOnly ? (pending ? "退出中" : "退出登录") : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-sm border border-border bg-card text-sm font-medium text-secondary-foreground shadow-sm transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:text-foreground hover:shadow-md focus:border-highlight focus:outline-none disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none",
        iconOnly ? "w-9 justify-center px-2" : "justify-start gap-2 px-2.5",
        className,
      )}
    >
      <LogOut className="size-4 shrink-0" />
      {!iconOnly && (
        <span className="whitespace-nowrap">{pending ? "退出中..." : "退出登录"}</span>
      )}
    </button>
  );
}
