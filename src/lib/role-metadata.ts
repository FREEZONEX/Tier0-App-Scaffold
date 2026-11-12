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
