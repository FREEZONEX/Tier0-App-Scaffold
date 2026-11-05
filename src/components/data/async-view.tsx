import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { uiText } from "@/lib/app-chrome";
import type { RequestResult } from "@/lib/hooks";
import { Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ENTER_FADE, SKELETON_SHIMMER } from "@/lib/interaction";

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
 *   const orders = useRequest("orders", (signal) =>
 *     requestJson<Order[]>("/api/orders", { signal }),
 *   );
 *   <AsyncView result={orders}>
 *     {(data) => <OrderTable rows={data} />}
 *   </AsyncView>
 */
const SKELETON_COLUMNS = ["22%", "30%", "16%", "18%"];

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
          "flex flex-col items-center justify-center gap-3 rounded-[4px] border border-state-error-border/70 bg-card px-6 py-10 text-center shadow-sm",
          ENTER_FADE,
          className,
        )}
      >
        <span className="inline-flex size-10 items-center justify-center rounded-[4px] border border-state-error-border bg-state-error-bg text-state-error-fg">
          <AlertCircle className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="typo-label text-foreground">{uiText("loadError")}</p>
          <p className="typo-body max-w-md text-muted-foreground">
            {error.message}
          </p>
        </div>
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
        className={cn(
          "overflow-hidden rounded-[4px] border border-border/70 bg-card",
          className,
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center gap-4 border-b border-border/70 bg-muted/40 px-4 py-3">
          {SKELETON_COLUMNS.map((width, col) => (
            <div
              key={col}
              className={cn("h-3 rounded-[4px]", SKELETON_SHIMMER)}
              style={{ width }}
            />
          ))}
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b border-border/50 px-4 py-3.5 last:border-b-0"
            style={{ opacity: 1 - row * 0.18 }}
          >
            {SKELETON_COLUMNS.map((width, col) => (
              <div
                key={col}
                className={cn("h-3.5 rounded-[4px]", SKELETON_SHIMMER)}
                style={{
                  width: col === 0 ? width : `calc(${width} - ${(row % 3) * 6}%)`,
                  animationDelay: `${row * 90}ms`,
                }}
              />
            ))}
          </div>
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
