import { useKitAdapter } from "@/components/kit/provider";
/** Fail closed; application owns actual authorization and server enforcement. */
export function usePermissions() {
  const adapter = useKitAdapter();
  return { canObject: adapter.canObject ?? (() => false) };
}
