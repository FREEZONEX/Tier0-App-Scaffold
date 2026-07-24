/**
 * Permission system — role-based access control.
 *
 * Agent: define your actions and permission matrix here.
 *
 * 1. Define ACTIONS with all permissioned operations.
 * 2. Create PERMISSION_MATRIX mapping each role to its allowed actions.
 * 3. Use can(user.roles, action) everywhere to check permissions.
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
export type RoleInput = string | readonly string[] | null | undefined;

export const PERMISSION_MATRIX: Record<string, Action[]> = {
  [ADMIN_ROLE]: [...ACTIONS],
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

export function toRoleList(roles: RoleInput): string[] {
  const values = typeof roles === "string" ? [roles] : (roles ?? []);
  return [...new Set(values.map((role) => role.trim()).filter(Boolean))];
}

/** Check whether any assigned role matches one of the required roles. */
export function hasAnyRole(
  assignedRoles: RoleInput,
  requiredRoles: readonly string[],
): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }

  const assigned = new Set(toRoleList(assignedRoles));
  return requiredRoles.some((role) => assigned.has(role));
}

/** Check the union of all assigned roles for an allowed action. */
export function can(roles: RoleInput, action: Action): boolean {
  return toRoleList(roles).some((role) =>
    PERMISSION_MATRIX[role]?.includes(action),
  );
}

/** Return the deduplicated effective permission union for all assigned roles. */
export function getEffectiveActions(roles: RoleInput): Action[] {
  return ACTIONS.filter((action) => can(roles, action));
}
