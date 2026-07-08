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

export const ACTIONS = [
  "manage_system",
] as const;

export type Action = (typeof ACTIONS)[number];

export const PERMISSION_MATRIX: Record<string, Action[]> = {
  [ADMIN_ROLE]: [...ACTIONS],
  // Test roles for platform role-switch verification (mirrored in roles.json).
  // Generated apps should replace these with real business roles.
  test_role_a: [],
  test_role_b: [],
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
