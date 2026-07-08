import type { ElementType } from "react";
import { can, type Action } from "@/lib/permissions";

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

// ─── Agent: add workspace modules only; station/review task flows stay out ───
export const defaultModules: NavModule[] = [];

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
  role: string | undefined,
  module: NavModule,
): boolean {
  const actions = getModuleActions(module);
  if (actions.length === 0) {
    return true;
  }
  if (!role) {
    return false;
  }
  return actions.every((action) => can(role, action));
}

export function filterVisibleModules(
  modules: NavModule[],
  role: string | undefined,
): NavModule[] {
  return modules.flatMap((module) => {
    const children = module.children
      ? filterVisibleModules(module.children, role)
      : undefined;
    const canViewParent =
      module.href || getModuleActions(module).length > 0
        ? canViewModule(role, module)
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
