import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let warnedLegacyEnv = false;
function warnLegacyEnv() {
  if (warnedLegacyEnv) return;
  warnedLegacyEnv = true;
  if (typeof console !== "undefined") {
    console.warn(
      "[scaffold] NEXT_PUBLIC_BASE_PATH is deprecated; rename to VITE_BASE_PATH.",
    );
  }
}

/**
 * Prefix a path with the configured base path.
 *
 * Reads `VITE_BASE_PATH` first; if it is unset, falls back to
 * `NEXT_PUBLIC_BASE_PATH` and logs a deprecation warning once.
 * The fallback exists so platform deployments that still inject the
 * old variable name keep working during migration.
 */
export function apiUrl(path: string): string {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_BASE_PATH as string | undefined)
      : undefined;
  if (fromVite) return `${fromVite}${path}`;

  const fromLegacy =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.NEXT_PUBLIC_BASE_PATH as string | undefined)
      : undefined;
  if (fromLegacy) {
    warnLegacyEnv();
    return `${fromLegacy}${path}`;
  }

  if (typeof process !== "undefined") {
    const fromProcess = process.env?.VITE_BASE_PATH;
    if (fromProcess) return `${fromProcess}${path}`;
    const fromProcessLegacy = process.env?.NEXT_PUBLIC_BASE_PATH;
    if (fromProcessLegacy) {
      warnLegacyEnv();
      return `${fromProcessLegacy}${path}`;
    }
  }

  return path;
}
