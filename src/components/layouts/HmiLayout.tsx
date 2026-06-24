"use client";

import type { ReactNode } from "react";
import { ReLoginButton } from "@/components/relogin-button";
import type { AppUser } from "@/lib/users";

export function HmiLayout({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="absolute right-3 top-3 z-50">
        <ReLoginButton iconOnly className="bg-card/95 backdrop-blur" />
      </div>
      <span className="sr-only">{user.displayName || user.username}</span>
      {children}
    </div>
  );
}
