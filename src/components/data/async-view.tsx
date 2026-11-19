import type { ReactNode } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

import { UiText } from "@/lib/locale";
import type { RequestResult } from "@/lib/hooks";
import { Button, EmptyState } from "@/components/ui";
import { cn, isTransientFailure } from "@/lib/utils";
import { ENTER_FADE, SKELETON_SHIMMER } from "@/lib/interaction";

/**
 * AsyncView — the one way to render a `useRequest` result. It resolves the
 * three states a data view actually has so pages never hand-roll
 * `if (!data) return null` (which stalls on an error as a fake "loading"):
 *
 *   - error with no data → one compact line: what failed + Retry (calls
 *                          result.refresh); the technical message sits behind
 *                          "Details". It stays inside the AsyncView's own area.
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
  const emptyView = empty ?? <EmptyState title={<UiText id="empty" />} />;

  if (error && data == null) {
    return (
      <LoadFailure
        error={error}
        retrying={isLoading}
        onRetry={refresh}
        className={className}
      />
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

/**
 * A failed load, said plainly: the copy names only a transient platform
 * failure (by its error code); the raw message stays behind "Details".
 */
function LoadFailure({
  error,
  retrying,
  onRetry,
  className,
}: {
  error: Error;
  retrying: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const details = error.message.trim();
  const summary = (
    <>
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-auto text-secondary-foreground">
        <UiText id={isTransientFailure(error) ? "loadErrorTransient" : "loadError"} />
      </span>
    </>
  );

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-1 rounded-[4px] border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground",
        ENTER_FADE,
        className,
      )}
    >
      {details ? (
        <details className="group min-w-0 flex-auto">
          <summary className="flex min-h-8 cursor-pointer list-none flex-wrap items-center gap-x-2 [&::-webkit-details-marker]:hidden">
            {summary}
            <span className="inline-flex items-center gap-1 hover:text-foreground">
              <UiText id="errorDetails" />
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <p className="mt-1 break-all font-mono text-xs">{details}</p>
        </details>
      ) : (
        <div className="flex min-h-8 min-w-0 flex-auto items-center gap-x-2">{summary}</div>
      )}
      <Button variant="outline" size="sm" loading={retrying} onClick={onRetry}>
        <UiText id="retry" />
      </Button>
    </div>
  );
}
