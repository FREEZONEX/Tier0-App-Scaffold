"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Render children only after hydration on the client.
 *
 * TanStack Start runs every component through SSR by default, and `"use client"`
 * is a no-op in this stack (unlike Next.js it doesn't split the bundle). Some
 * libraries call React APIs at module scope or rely on `window` / `document`,
 * which crashes during SSR with errors like:
 *
 *   - `Cannot read properties of null (reading 'useContext')`  (recharts)
 *   - `document is not defined`                                (dnd-kit, motion)
 *   - hydration mismatch warnings                              (Date.now() in render)
 *
 * Wrap those subtrees with `<ClientOnly>` so they're skipped on the server
 * pass and rendered after `useEffect` fires on the client. Use the `fallback`
 * prop to show a Skeleton or spinner during the SSR pass — it keeps layout
 * stable and prevents content-shift on hydration.
 *
 * Usage:
 *
 *   <ClientOnly fallback={<Skeleton className="h-72" />}>
 *     <ResponsiveContainer>
 *       <LineChart data={...}>...</LineChart>
 *     </ResponsiveContainer>
 *   </ClientOnly>
 *
 * Don't reach for this for everything — most components SSR fine. Use it for:
 *   - Recharts charts (always)
 *   - dnd-kit DragOverlay / sortable contexts
 *   - `motion` components that read layout (`layoutId`, `useScroll`)
 *   - Anything that touches `window` / `document` / `localStorage` in render
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  // The whole point of this component is to set state on mount and re-render.
  // The `set-state-in-effect` advisory rule does not apply.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
