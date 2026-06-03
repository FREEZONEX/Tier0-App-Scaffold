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
