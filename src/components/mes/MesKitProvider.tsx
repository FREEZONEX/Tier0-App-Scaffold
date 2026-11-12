"use client";

import { useMemo, type ReactNode } from "react";
import { ComponentKitProvider } from "@/components/kit/provider";
import { createMesKitAdapter } from "@/lib/mes-list-config";

export function MesKitProvider({ roles, children }: { roles: readonly string[]; children: ReactNode }) {
  const roleKey = roles.join(",");
  const adapter = useMemo(() => createMesKitAdapter(roleKey ? roleKey.split(",") : []), [roleKey]);
  return <ComponentKitProvider adapter={adapter}>{children}</ComponentKitProvider>;
}
