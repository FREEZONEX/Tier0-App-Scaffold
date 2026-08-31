/**
 * Permission system — role-based access control.
 *
 * Agent: define your actions and permission matrix here.
 *
 * The scaffold ships with NO roles. Every role — including one named "admin",
 * if the business actually needs it — is an ordinary business role you define
 * from the requirements and register through the full chain:
 *
 * 1. Define ACTIONS with all permissioned operations.
 * 2. Create PERMISSION_MATRIX mapping each role to its allowed actions.
 * 3. Mirror every matrix role in `role-metadata.ts` and `roles.json` — every
 *    role, no exceptions; the platform can only assign registered roles.
 * 4. Use can(user.roles, action) everywhere to check permissions.
 *
 * Until roles are defined, every request resolves to zero permissions —
 * nothing is granted implicitly.
 */

import { ROLE_METADATA, getRoleMetadata } from "./role-metadata";

export const ACTIONS = [
  "manage_system",
] as const;

export type Action = (typeof ACTIONS)[number];
export type RoleInput = string | readonly string[] | null | undefined;

export const PERMISSION_MATRIX: Record<string, Action[]> = {
};

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.keys(ROLE_METADATA).map((key) => [key, getRoleMetadata(key).label]),
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
