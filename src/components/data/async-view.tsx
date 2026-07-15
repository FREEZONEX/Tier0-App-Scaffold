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
 *   - no data yet        → skeleton
 *   - loaded             → children(data), or the empty view when isEmpty hits
 *
 *   const orders = useRequest("orders", loadOrders);
 *   <AsyncView result={orders} isEmpty={(d) => d.length === 0}>
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
  const { data, error, refresh } = result;

  if (error && data == null) {
    return (
      <div
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

  if (data == null) {
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

  if (isEmpty?.(data)) {
    return <>{empty ?? <EmptyState title={uiText("empty")} />}</>;
  }

  return <>{children(data)}</>;
}
