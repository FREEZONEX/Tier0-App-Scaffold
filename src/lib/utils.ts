import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Prefix a path with the configured base path.
 *
 * Reads the Vite-standard `VITE_BASE_PATH`. Unprefixed runtime env belongs on
 * the Node side; client bundles should only depend on `VITE_*` values.
 */
export function apiUrl(path: string): string {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_BASE_PATH as string | undefined)
      : undefined;
  if (fromVite) return `${fromVite}${path}`;

  if (typeof process !== "undefined") {
    const fromProcess = process.env?.VITE_BASE_PATH;
    if (fromProcess) return `${fromProcess}${path}`;
  }

  return path;
}
