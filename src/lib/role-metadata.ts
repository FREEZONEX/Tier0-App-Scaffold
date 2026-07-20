import { APP_HOME_ROUTE, getAppChromeSafeRoute } from "./app-chrome";

export interface RoleMetadata {
  label: string;
  description: string;
  defaultRoute: string;
}

export const ROLE_METADATA = {
  admin: {
    label: "Admin",
    description: "Full access to all features and settings.",
    defaultRoute: APP_HOME_ROUTE,
  },
} as const satisfies Record<string, RoleMetadata>;

export type RoleKey = keyof typeof ROLE_METADATA;

export function getRoleMetadata(role: string): RoleMetadata {
  const metadata = ROLE_METADATA[role as RoleKey] ?? {
    label: role,
    description: "Role description is not configured.",
    defaultRoute: APP_HOME_ROUTE,
  };

  return {
    ...metadata,
    defaultRoute: getAppChromeSafeRoute(metadata.defaultRoute),
  };
}
