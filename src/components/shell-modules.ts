import type { ElementType } from "react";
import { can, type Action, type RoleInput } from "@/lib/permissions";

export interface NavModule {
  key: string;
  label: string;
  href?: string;
  icon?: ElementType;
  actions?: Action[];
  children?: NavModule[];
  badge?: string;
  locked?: boolean;
  disabledReason?: string;
}

export interface NavigationLeaf {
  key: string;
  label: string;
  href: string;
}

function normalizeNavigationHref(href: string): string {
  return href === "/" ? href : href.replace(/\/+$/, "");
}

/**
 * Validate the actual sidebar declaration before Shell renders it and expose
 * its clickable leaves to build/smoke gates. Groups may omit href; every leaf
 * must use one unique, absolute application path.
 */
export function validateNavigationModules(
  modules: readonly NavModule[],
): NavigationLeaf[] {
  const errors: string[] = [];
  const keys = new Map<string, string>();
  const hrefs = new Map<string, string>();
  const leaves: NavigationLeaf[] = [];

  function visit(items: readonly NavModule[], parentLabel?: string) {
    for (const module of items) {
      const key = module.key.trim();
      const label = module.label.trim();
      const location = parentLabel
        ? `${parentLabel} > ${label || key}`
        : label || key;
      const previousKey = keys.get(key);

      if (!key) {
        errors.push(`${location || "Unnamed module"}: key is required`);
      } else if (previousKey) {
        errors.push(`${location}: key "${key}" is already used by ${previousKey}`);
      } else {
        keys.set(key, location);
      }

      if (!label) {
        errors.push(`${key || "Unnamed module"}: label is required`);
      }

      if (module.children?.length) {
        visit(module.children, location);
        continue;
      }

      const rawHref = module.href?.trim();
      if (!rawHref) {
        errors.push(`${location}: clickable leaf requires href`);
        continue;
      }
      if (!rawHref.startsWith("/")) {
        errors.push(`${location}: href "${rawHref}" must start with /`);
        continue;
      }
      if (/[?#]/.test(rawHref)) {
        errors.push(
          `${location}: href "${rawHref}" must be a route path without query or hash`,
        );
        continue;
      }

      const href = normalizeNavigationHref(rawHref);
      const previousHref = hrefs.get(href);
      if (previousHref) {
        errors.push(`${location}: href "${href}" is already used by ${previousHref}`);
        continue;
      }

      hrefs.set(href, location);
      leaves.push({ key, label, href });
    }
  }

  visit(modules);

  if (errors.length > 0) {
    throw new Error(`Invalid sidebar navigation:\n- ${errors.join("\n- ")}`);
  }

  return leaves;
}

export function defineNavigationModules(modules: NavModule[]): NavModule[] {
  validateNavigationModules(modules);
  return modules;
}

// ─── Agent: add workspace modules only; station/review task flows stay out ───
export const defaultModules = defineNavigationModules([]);

const MODULE_ACTIONS_BY_KEY: Record<string, Action[]> = {
  settings: ["manage_system"],
  system: ["manage_system"],
  system_config: ["manage_system"],
  systemConfig: ["manage_system"],
};

const MODULE_ACTIONS_BY_LABEL: Record<string, Action[]> = {
  Settings: ["manage_system"],
  "System Configuration": ["manage_system"],
};

export function getModuleActions(module: NavModule): Action[] {
  return (
    module.actions ??
    MODULE_ACTIONS_BY_KEY[module.key] ??
    MODULE_ACTIONS_BY_LABEL[module.label] ??
    []
  );
}

export function canViewModule(
  roles: RoleInput,
  module: NavModule,
): boolean {
  const actions = getModuleActions(module);
  if (actions.length === 0) {
    return true;
  }
  if (!roles || (Array.isArray(roles) && roles.length === 0)) {
    return false;
  }
  return actions.every((action) => can(roles, action));
}

export function filterVisibleModules(
  modules: NavModule[],
  roles: RoleInput,
): NavModule[] {
  return modules.flatMap((module) => {
    const children = module.children
      ? filterVisibleModules(module.children, roles)
      : undefined;
    const canViewParent =
      module.href || getModuleActions(module).length > 0
        ? canViewModule(roles, module)
        : true;

    if (!canViewParent && !children?.length) {
      return [];
    }

    if (children !== undefined) {
      if (!children.length) {
        return module.href && canViewParent ? [{ ...module, children }] : [];
      }

      return [{ ...module, children }];
    }

    return module.href && canViewParent ? [module] : [];
  });
}
