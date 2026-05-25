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

export const ADMIN_ROLE = "admin";

export const ACTIONS = [
  "view_dashboard",
  "manage_system",
  "manage_work_orders",
  "report_production",
  "review_quality",
] as const;

export type Action = (typeof ACTIONS)[number];

export const PERMISSION_MATRIX: Record<string, Action[]> = {
  [ADMIN_ROLE]: [...ACTIONS],
};

/** Check whether a role is allowed to perform an action. */
export function can(role: string, action: Action): boolean {
  const allowed = PERMISSION_MATRIX[role];
  if (!allowed) return false;
  return allowed.includes(action);
}
