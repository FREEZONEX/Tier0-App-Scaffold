import type { ErrorComponentProps } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface RouteErrorProps {
  /** Error surfaced by the route's `errorComponent` boundary. */
  error: ErrorComponentProps["error"];
  /** Boundary reset callback; when provided renders a Retry action. */
  reset?: ErrorComponentProps["reset"];
  /** Headline shown above the error message. */
  title?: string;
  /**
   * Outer container overrides. Layouts differ in height/background
   * (`h-full` inside the shell vs `h-screen bg-background` for monitors),
   * so callers pass those here while the card itself stays shared.
   */
  className?: string;
}

/**
 * RouteError — the shared fallback rendered by every route `errorComponent`.
 *
 * One component owns the error card's responsive typography: the title and
 * message read comfortably on phones (base) and step up on wider screens
 * (`sm:`). Keeping it here means the mobile sizing is fixed in a single place
 * instead of being copied into each route boundary.
 */
export function RouteError({
  error,
  reset,
  title = "Page failed to load",
  className,
}: RouteErrorProps) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center p-6 sm:p-12",
        className,
      )}
    >
      <div className="max-w-md text-center">
        <p className="text-base font-medium text-destructive sm:text-lg">
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {error.message}
        </p>
        {reset ? (
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="mt-4"
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}
