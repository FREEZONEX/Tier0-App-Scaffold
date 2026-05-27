"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "var(--font-geist-mono)",
          fontSize: "12px",
          border: "1px solid var(--tier0-border)",
          borderRadius: "4px",
        },
      }}
    />
  );
}
