export type AppChrome =
  | "workspace"
  | "station"
  | "review"
  | "monitor"
  | "auth";

type ChromeRouteRule = {
  chrome: AppChrome;
  prefix: `/${string}`;
};

export const APP_PRIMARY_CHROME: AppChrome = "workspace";
export const APP_HOME_ROUTE = "/";

/**
 * Product name shown in the sidebar brand mark and the browser tab title.
 * This is the ONE place the app name is defined — change it here and it
 * updates everywhere. Generated apps MUST replace this default with the real
 * business app name (see AGENTS.md). Keep it short: it renders on at most two
 * lines in the sidebar, so aim for one or two words plus an optional
 * qualifier (e.g. "研发仓 WMS", "Supplier Portal").
 */
export const APP_NAME = "Manufacturing App";

/**
 * Product locale. Set it together with APP_NAME — it drives `<html lang>`
 * (native date inputs localize from it: zh-CN renders 年/月/日) and the
 * default labels of shared dialogs. Generated apps set this to the app's
 * product language.
 */
export const APP_LOCALE: "en" | "zh-CN" = "en";

const UI_COPY = {
  en: {
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    loadError: "Couldn't load data",
    retry: "Reload",
    empty: "No data yet",
  },
  "zh-CN": {
    save: "保存",
    cancel: "取消",
    confirm: "确认",
    loadError: "数据加载失败",
    retry: "重新加载",
    empty: "暂无数据",
  },
} as const;

/** Locale-aware default labels for shared UI primitives. */
export function uiText(key: keyof (typeof UI_COPY)["en"]): string {
  return UI_COPY[APP_LOCALE][key];
}

// Register every non-workspace route family here so navigation, default entry
// routes, and sidebar modules all follow the same app chrome policy.
const APP_CHROME_ROUTE_RULES: readonly ChromeRouteRule[] = [
  { chrome: "auth", prefix: "/login" },
  { chrome: "station", prefix: "/station" },
  { chrome: "review", prefix: "/review" },
  { chrome: "monitor", prefix: "/monitor" },
];

function normalizeAppHref(href: string): string {
  if (!href) {
    return APP_HOME_ROUTE;
  }

  return href.startsWith("/") ? href : `/${href}`;
}

function matchesRoutePrefix(href: string, prefix: string): boolean {
  return href === prefix || href.startsWith(`${prefix}/`);
}

export function getAppChromeForHref(href: string): AppChrome {
  const normalizedHref = normalizeAppHref(href);
  const matchedRule = APP_CHROME_ROUTE_RULES.find(({ prefix }) =>
    matchesRoutePrefix(normalizedHref, prefix),
  );

  return matchedRule?.chrome ?? APP_PRIMARY_CHROME;
}

export function isAppChromeCompatibleHref(href: string): boolean {
  return getAppChromeForHref(href) === APP_PRIMARY_CHROME;
}

export function getAppChromeSafeRoute(href: string): string {
  const normalizedHref = normalizeAppHref(href);
  return isAppChromeCompatibleHref(normalizedHref)
    ? normalizedHref
    : APP_HOME_ROUTE;
}

type SidebarModuleShape<T> = {
  href?: string;
  children?: readonly T[];
};

export function filterSidebarModules<T extends SidebarModuleShape<T>>(
  modules: readonly T[],
): T[] {
  return modules.flatMap((module) => {
    const filteredChildren = module.children
      ? filterSidebarModules(module.children)
      : undefined;
    const hasCompatibleHref = module.href
      ? isAppChromeCompatibleHref(module.href)
      : false;
    const hasCompatibleChildren = Boolean(filteredChildren?.length);

    if (!hasCompatibleHref && !hasCompatibleChildren) {
      return [];
    }

    if (filteredChildren === undefined) {
      return [module];
    }

    return [{ ...module, children: filteredChildren }];
  });
}
