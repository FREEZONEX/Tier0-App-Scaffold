"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { uiText } from "@/lib/app-chrome";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

const isOnline = () => navigator.onLine !== false;
const serverOnline = () => true;

/**
 * OfflineBanner — tells operators the moment the device loses its network, so
 * nobody keeps entering work that cannot be saved. It disappears on its own
 * when the connection returns (data then refreshes through the request hooks).
 * Rendered once by each app chrome (Shell, Station, Review, Monitor); pages do
 * not add their own.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, serverOnline);
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex shrink-0 items-center justify-center gap-2 border-b border-state-paused-border bg-state-paused-bg px-4 py-2 text-sm font-medium text-state-paused-fg"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>{uiText("offline")}</span>
    </div>
  );
}
