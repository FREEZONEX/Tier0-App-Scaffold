import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { sendPreviewError } from "@/lib/preview-bridge";

export interface RouteErrorBoundaryProps {
  /** Error surfaced by the route's `errorComponent` boundary. */
  error: ErrorComponentProps["error"];
  /** Which route failed; goes into the preview report and the DOM marker. */
  scope?: string;
}

/**
 * RouteErrorBoundary — the shared fallback for every route `errorComponent`.
 *
 * It renders **no visible UI**. The Builder preview intercepts the failure
 * through the preview bridge (`tier0.preview.error`) and shows its own
 * blocking error card with Retry and "Ask Agent to Fix"; an in-app red
 * headline would only duplicate that card underneath it.
 *
 * What it does render is a hidden machine-readable marker so
 * `scripts/route-smoke.mjs` can still tell a failed route from a working one
 * (server-rendered failures used to be detected by the visible headline).
 */
export function RouteErrorBoundary({
  error,
  scope = "page",
}: RouteErrorBoundaryProps) {
  const message = error.message || `${scope} failed to load`;

  useEffect(() => {
    sendPreviewError(message, "app");
  }, [message]);

  return (
    <div data-route-error={scope} hidden>
      {message}
    </div>
  );
}
