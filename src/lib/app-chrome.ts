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
 * Brand icon shown in the sidebar / station brand mark — a public image asset
 * path (rendered as a square `<img>`). This is the ONE place the in-app icon is
 * defined. It MUST be the SAME image the platform shows in its app list / detail
 * header: generated apps design a square icon, save it under `public/`, point
 * APP_ICON here, AND upload the same file to the platform via the
 * `update_app_info` tool (`icon_path`). Do both together — see AGENTS.md
 * "Branding". The default below is a neutral placeholder.
 */
export const APP_ICON = "/app-icon.png";

/**
 * Product languages. Set them together with APP_NAME — the current one drives
 * `<html lang>` (native date inputs localize from it: zh-CN renders 年/月/日)
 * and every string the app shows through `useCopy` / `useUiText`
 * (`@/lib/locale`).
 *
 * - APP_SUPPORTED_LOCALES: the languages every copy table is written in.
 *   Adding one means adding its column to UI_COPY and to every `defineCopy`
 *   table; TypeScript reports the tables that miss it.
 * - APP_DEFAULT_LOCALE: the product language. The first screen renders in it,
 *   and it stays when the App is opened outside the platform, when the
 *   platform has not sent a language, or when the platform language is not
 *   supported.
 * - APP_FOLLOW_PLATFORM_LANGUAGE: switch to the platform's language when the
 *   App runs embedded in the platform. false keeps APP_DEFAULT_LOCALE.
 */
export const APP_SUPPORTED_LOCALES = ["en", "zh-CN"] as const;
export type AppLocale = (typeof APP_SUPPORTED_LOCALES)[number];
export const APP_DEFAULT_LOCALE: AppLocale = "en";
export const APP_FOLLOW_PLATFORM_LANGUAGE: boolean = true;

/**
 * The App locale for a platform language tag (`zh-cn`, `en`, `ja`, …): the
 * supported locale with the same tag ignoring case, else the first one with
 * the same primary language (`zh-tw` → `zh-CN`), else APP_DEFAULT_LOCALE.
 */
export function resolveAppLocale(platformLanguage: string | undefined): AppLocale {
  if (!APP_FOLLOW_PLATFORM_LANGUAGE || !platformLanguage) return APP_DEFAULT_LOCALE;
  const wanted = platformLanguage.toLowerCase();
  const primary = wanted.split("-")[0];
  return (
    APP_SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === wanted) ??
    APP_SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === primary) ??
    APP_DEFAULT_LOCALE
  );
}

/** Values for `{name}` placeholders in a copy string. */
export type CopyParams = Readonly<Record<string, string | number>>;

/** One string per key in every supported locale. */
export type Copy<K extends string> = {
  readonly [L in AppLocale]: { readonly [Key in K]: string };
};

/**
 * A message to show later in whatever language is current then, such as a
 * validation error kept in state: store the key and its params, never the
 * translated string, so switching language re-translates it.
 */
export type CopyMessage<K extends string> = { key: K; params?: CopyParams };

/**
 * Declares a copy table. Every locale must have exactly the same keys;
 * TypeScript reports a key missing from one of them.
 */
export function defineCopy<K extends string>(copy: Copy<K>): Copy<K> {
  return copy;
}

/** The string for `key` in `locale`, with `{name}` placeholders filled from `params`. */
export function translate<K extends string>(
  copy: Copy<K>,
  locale: AppLocale,
  key: K,
  params?: CopyParams,
): string {
  const text = copy[locale][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

/** Default labels of the shared UI primitives; read them with `useUiText()`. */
export const UI_COPY = defineCopy({
  en: {
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    loadError: "This section couldn't be loaded",
    loadErrorTransient: "Temporarily unavailable. Try again shortly",
    errorDetails: "Details",
    retry: "Retry",
    empty: "No data yet",
    loading: "Loading…",
    noRoles: "No role assigned",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    openNavigation: "Open navigation",
    closeNavigation: "Close navigation",
    updatedAt: "Updated",
    signedInAs: "Signed in",
    offline: "Offline — changes can't be saved until the connection returns",
  },
  "zh-CN": {
    save: "保存",
    cancel: "取消",
    confirm: "确认",
    loadError: "这块内容暂时无法加载",
    loadErrorTransient: "暂时无法加载，请稍后重试",
    errorDetails: "查看详情",
    retry: "重试",
    empty: "暂无数据",
    loading: "加载中…",
    noRoles: "未分配角色",
    expandSidebar: "展开侧边栏",
    collapseSidebar: "收起侧边栏",
    openNavigation: "打开导航",
    closeNavigation: "关闭导航",
    updatedAt: "更新于",
    signedInAs: "当前用户",
    offline: "网络已断开，恢复连接前操作无法保存",
  },
});

export type UiTextKey = keyof (typeof UI_COPY)["en"];

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
