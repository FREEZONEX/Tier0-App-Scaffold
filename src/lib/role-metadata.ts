import { APP_HOME_ROUTE, getAppChromeSafeRoute } from "./app-chrome";

export interface RoleMetadata {
  label: string;
  description: string;
  defaultRoute: string;
}

export const ROLE_METADATA = {
  admin: {
    label: "Admin",
    description: "Configure the system, manage permissions, and handle cross-module administration.",
    defaultRoute: APP_HOME_ROUTE,
  },
  sales: {
    label: "Sales",
    description: "Review customer demand, order progress, and delivery-related information.",
    defaultRoute: APP_HOME_ROUTE,
  },
  planner: {
    label: "Planner",
    description: "Maintain production plans, scheduling cadence, and work-order priorities.",
    defaultRoute: APP_HOME_ROUTE,
  },
  production_supervisor: {
    label: "Production Supervisor",
    description: "Track line execution, resolve exceptions, and coordinate shop-floor resources.",
    defaultRoute: APP_HOME_ROUTE,
  },
  operator: {
    label: "Operator",
    description: "Perform station tasks, report production, scan, and submit shop-floor feedback.",
    defaultRoute: APP_HOME_ROUTE,
  },
  quality: {
    label: "Quality",
    description: "Handle inspections, quality decisions, exception reviews, and release activities.",
    defaultRoute: APP_HOME_ROUTE,
  },
  warehouse: {
    label: "Warehouse",
    description: "Handle receiving, issuing, stock movement, staging, and warehouse execution tasks.",
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
