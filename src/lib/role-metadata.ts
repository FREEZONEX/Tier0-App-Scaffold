import { APP_HOME_ROUTE, getAppChromeSafeRoute } from "./app-chrome";

export interface RoleMetadata {
  label: string;
  description: string;
  defaultRoute: string;
}

export const ROLE_METADATA = {
  admin: {
    label: "Admin",
    description: "Full access — Edit and Preview the HMI mimic, configure the system.",
    defaultRoute: APP_HOME_ROUTE,
  },
  operator: {
    label: "Operator",
    description: "Preview the real HMI mimic read-only — no edit access.",
    defaultRoute: APP_HOME_ROUTE,
  },
  guest: {
    label: "Guest",
    description: "Read-only built-in demo mimic only. Assigned when the platform has not bound a role yet.",
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
