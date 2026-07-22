/**
 * Permission system — role-based access control.
 *
 * Agent: define your actions and permission matrix here.
 *
 * 1. Define ACTIONS with all permissioned operations.
 * 2. Create PERMISSION_MATRIX mapping each role to its allowed actions.
 * 3. Use can(role, action) everywhere to check permissions.
 *
 * The template always ships with a built-in Admin role. When adding actions,
 * add them to ACTIONS first so Admin automatically retains full access.
 */

import { ROLE_METADATA, getRoleMetadata } from "./role-metadata";

export const ADMIN_ROLE = "admin";
/**
 * No permissions at all — used when the gateway has no real role to inject
 * (e.g. an unassigned viewer). Deliberately NOT a PERMISSION_MATRIX key: it
 * is app-internal, like ADMIN_ROLE, and must never be a platform-assignable
 * business role (see docs/role-registration.md). `can()` already resolves
 * any unrecognized role to zero permissions, so leaving it out of the matrix
 * is sufficient — the fallback session still mints with this role string.
 */
export const GUEST_ROLE = "guest";

export const ACTIONS = [
  "view_dashboard",
  "edit_mimic",
  "manage_system",
  "manage_sales_orders",
  "manage_scheduling",
  "manage_kitting",
  "manage_traceability",
  "manage_master_data",
  "manage_work_orders",
  "report_production",
  "review_quality",
] as const;

export type Action = (typeof ACTIONS)[number];

export const PERMISSION_MATRIX: Record<string, Action[]> = {
  [ADMIN_ROLE]: [...ACTIONS],
  sales: ["view_dashboard", "manage_sales_orders"],
  planner: ["view_dashboard", "manage_work_orders", "manage_scheduling"],
  production_supervisor: [
    "view_dashboard",
    "manage_work_orders",
    "manage_scheduling",
    "manage_traceability",
    "report_production",
  ],
  operator: ["view_dashboard", "report_production"],
  quality: ["view_dashboard", "review_quality", "manage_traceability"],
  warehouse: ["view_dashboard", "manage_kitting"],
};

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_METADATA).map(([key, metadata]) => [
    key,
    metadata.label,
  ]),
);

export function getDefaultRouteForRole(role: string): string {
  return getRoleMetadata(role).defaultRoute;
}

/** Check whether a role is allowed to perform an action. */
export function can(role: string, action: Action): boolean {
  const allowed = PERMISSION_MATRIX[role];
  if (!allowed) return false;
  return allowed.includes(action);
}
