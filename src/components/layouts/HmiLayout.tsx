"use client";

import type { ReactNode } from "react";
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
      <span className="sr-only">{user.displayName || user.username}</span>
      {children}
    </div>
  );
}
