"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={10}
      offset={16}
      mobileOffset={12}
      visibleToasts={4}
      closeButton
      toastOptions={{
        className: "tier0-toast",
        style: {
          fontFamily: "var(--font-app-sans)",
          fontSize: "13px",
          border: "1px solid var(--tier0-border)",
          borderRadius: "var(--tier0-radius-md)",
          boxShadow: "var(--shadow-overlay)",
          background: "var(--card)",
          color: "var(--foreground)",
          padding: "12px 14px",
        },
      }}
    />
  );
}
