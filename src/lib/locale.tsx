"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getPlatformLanguage, onPlatformLanguage } from "@tier0/sdk-v2/page-runtime";
import {
  APP_DEFAULT_LOCALE,
  UI_COPY,
  resolveAppLocale,
  translate,
  type AppLocale,
  type Copy,
  type CopyParams,
  type UiTextKey,
} from "@/lib/app-chrome";

const LocaleContext = createContext<AppLocale>(APP_DEFAULT_LOCALE);

const platformLocale = () => resolveAppLocale(getPlatformLanguage());
const firstScreenLocale = () => APP_DEFAULT_LOCALE;

/**
 * The App's current language: APP_DEFAULT_LOCALE on the server and on the
 * first client render (so hydration matches), then the platform's language
 * once the page runtime has it (`@tier0/sdk-v2/page-runtime`).
 *
 * Switching only changes this one value: text re-renders in place, and what
 * the user typed, focus, scroll position and the URL stay. Mounted once by
 * the root route around the whole app. Never remount it, never key anything
 * on the locale, and never reload the page or the router to switch language:
 * each of those throws away unsaved form input. `<html lang>` follows it by
 * a direct DOM update.
 */
export function LocaleProvider({ children }: { children?: ReactNode }) {
  const locale = useSyncExternalStore(onPlatformLanguage, platformLocale, firstScreenLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The current App locale, also for `Intl` / `toLocaleString` at render time. */
export function useLocale(): AppLocale {
  return useContext(LocaleContext);
}

/**
 * The translator for a `defineCopy` table in the current locale:
 * `t(key, params?)`. Call it while rendering, never store its result.
 */
export function useCopy<K extends string>(copy: Copy<K>): (key: K, params?: CopyParams) => string {
  const locale = useLocale();
  return useCallback((key: K, params?: CopyParams) => translate(copy, locale, key, params), [copy, locale]);
}

/** Default labels of the shared UI primitives (Save, Cancel, Retry, …). */
export function useUiText(): (key: UiTextKey) => string {
  return useCopy(UI_COPY);
}

/**
 * One shared UI label as a text node, for components that stay hook-free
 * (their children re-render on their own when the language switches).
 */
export function UiText({ id }: { id: UiTextKey }) {
  return useUiText()(id);
}
