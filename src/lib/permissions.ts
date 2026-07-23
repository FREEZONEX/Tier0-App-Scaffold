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
] as const;

export type Action = (typeof ACTIONS)[number];

// This SCADA/HMI product has exactly three roles, matching the three HMI
// view tiers (see forceDemo/canEdit in src/routes/_app.index.tsx):
// admin = Edit + Preview, operator = Preview only, guest = Demo only.
// GUEST_ROLE stays out of this matrix on purpose (see its comment above).
export const PERMISSION_MATRIX: Record<string, Action[]> = {
  [ADMIN_ROLE]: [...ACTIONS],
  operator: ["view_dashboard"],
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
