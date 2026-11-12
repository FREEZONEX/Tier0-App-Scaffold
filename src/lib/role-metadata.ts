import { APP_HOME_ROUTE, getAppChromeSafeRoute } from "./app-chrome";

export interface RoleMetadata {
  label: string;
  description: string;
  defaultRoute: string;
}

/**
 * Display metadata for every role in PERMISSION_MATRIX. The scaffold ships
 * with no roles; add one entry per business role you define, e.g.:
 *
 *   warehouse_manager: {
 *     label: "Warehouse Manager",
 *     description: "Manages inventory and releases work orders.",
 *     defaultRoute: "/orders",
 *   },
 */
export const ROLE_METADATA = {
  planner: {
    label: "计划员",
    description: "维护配方，创建、下达和作废生产批次。",
    defaultRoute: "/batches",
  },
  operator: {
    label: "操作员",
    description: "在投料工位按步骤投料并报完工。",
    defaultRoute: "/batches",
  },
  viewer: {
    label: "查看者",
    description: "查看配方与批次进度。",
    defaultRoute: "/batches",
  },
} as const satisfies Record<string, RoleMetadata>;

export type RoleKey = keyof typeof ROLE_METADATA;

export function getRoleMetadata(role: string): RoleMetadata {
  const metadata =
    (ROLE_METADATA as Record<string, RoleMetadata>)[role] ?? {
      label: role,
      description: "Role description is not configured.",
      defaultRoute: APP_HOME_ROUTE,
    };

  return {
    ...metadata,
    defaultRoute: getAppChromeSafeRoute(metadata.defaultRoute),
  };
}
