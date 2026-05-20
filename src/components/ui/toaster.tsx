"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster — global toast notification container.
 * Add <Toaster /> once in the root layout. Then use:
 *
 *   import { toast } from "sonner";
 *   toast.success("Work order created");
 *   toast.error("Invalid state transition");
 *   toast("Equipment CNC-03 is now idle");
 */

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "12px",
          border: "1px solid var(--border)",
          borderRadius: "8px",
        },
      }}
    />
  );
}
