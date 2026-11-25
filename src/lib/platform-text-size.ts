"use client";

import { getPlatformTextSize, onPlatformTextSize } from "@tier0/sdk-v2/page-runtime";
import { useEffect, useSyncExternalStore } from "react";

const defaultTextSize = () => undefined;

/** Applies the host's preference without changing the App tree or its state. */
export function PlatformTextSizeSync() {
  const size = useSyncExternalStore(onPlatformTextSize, getPlatformTextSize, defaultTextSize);

  useEffect(() => {
    const root = document.documentElement;
    if (size) root.dataset.platformTextSize = size;
    else delete root.dataset.platformTextSize;
    return () => {
      delete root.dataset.platformTextSize;
    };
  }, [size]);

  return null;
}
