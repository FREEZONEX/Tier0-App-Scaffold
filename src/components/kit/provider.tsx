"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createKitApi, type KitApi, type KitRequest } from "@/lib/component-kit/api-client";
import type { SelectOption } from "@/lib/component-kit/types";

export type { KitApi, KitRequest };
export interface ComponentKitAdapter {
  /** Logical component resource contract, NOT an automatically fetched URL.
   * Map to application services; preserve signal and enforce permissions server-side. */
  request: (request: KitRequest) => Promise<unknown>;
  /** UI visibility only. Omitted checks deny operations. */
  canObject?: (objectCode: string, operation: string) => boolean;
  printableObjects?: SelectOption[];
  codeRuleTypes?: SelectOption[];
  codeRuleProperties?: Record<string, { key: string; label: string }[]>;
}
const missing: ComponentKitAdapter = {
  request: async () => { throw new Error("ComponentKitProvider requires an application data adapter for this operation."); },
};
const Context = createContext<ComponentKitAdapter>(missing);
/** Scope data and permissions to a subtree. No global client or cross-request SSR state. */
export function ComponentKitProvider({ adapter, children }: { adapter: ComponentKitAdapter; children?: ReactNode }) {
  return <Context.Provider value={adapter}>{children}</Context.Provider>;
}
export function useKitAdapter() { return useContext(Context); }
export function useKitApi(): KitApi {
  const adapter = useKitAdapter();
  return useMemo(() => createKitApi(adapter.request), [adapter.request]);
}
