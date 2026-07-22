import type { ReactNode } from "react";

import { uiText } from "@/lib/app-chrome";
import type { RequestResult } from "@/lib/hooks";
import { Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * AsyncView — the one way to render a `useRequest` result. It resolves the
 * three states a data view actually has so pages never hand-roll
 * `if (!data) return null` (which stalls on an error as a fake "loading"):
 *
 *   - error with no data → message + Reload button (calls result.refresh)
 *   - loading            → skeleton (only while in flight — a settled request
 *                          with no data shows the empty view, never a spinner)
 *   - loaded             → children(data); empty arrays show the empty view
 *                          automatically, other shapes via isEmpty
 *
 *   const orders = useRequest("orders", loadOrders);
 *   <AsyncView result={orders}>
 *     {(data) => <OrderTable rows={data} />}
 *   </AsyncView>
 */
export interface AsyncViewProps<T> {
  result: RequestResult<T>;
  children: (data: T) => ReactNode;
  /** Treat loaded data as empty, e.g. `(rows) => rows.length === 0`. */
  isEmpty?: (data: T) => boolean;
  /** Shown when data is empty. Defaults to a neutral EmptyState. */
  empty?: ReactNode;
  className?: string;
}

export function AsyncView<T>({
  result,
  children,
  isEmpty,
  empty,
  className,
}: AsyncViewProps<T>) {
  const { data, error, isLoading, refresh } = result;
  const emptyView = empty ?? <EmptyState title={uiText("empty")} />;

  if (error && data == null) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center",
          className,
        )}
      >
        <p className="typo-label text-foreground">{uiText("loadError")}</p>
        <p className="typo-body max-w-md text-muted-foreground">{error.message}</p>
        <Button variant="outline" onClick={refresh}>
          {uiText("retry")}
        </Button>
      </div>
    );
  }

  // Skeleton only while a request is actually in flight. A settled request
  // with no data (e.g. `enabled: false`) falls through to the empty view —
  // never an infinite skeleton, which is the fake-loading bug in disguise.
  if (data == null && isLoading) {
    return (
      <div
        className={cn("space-y-3", className)}
        aria-busy="true"
        aria-live="polite"
      >
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-12 animate-pulse rounded-md bg-surface-inset"
          />
        ))}
      </div>
    );
  }

  if (data == null) {
    return <>{emptyView}</>;
  }

  // Array payloads get the empty view by default; non-array payloads need an
  // explicit isEmpty since we can't guess their shape.
  const showEmpty = isEmpty
    ? isEmpty(data)
    : Array.isArray(data) && data.length === 0;

  if (showEmpty) {
    return <>{emptyView}</>;
  }

  return <>{children(data)}</>;
}
