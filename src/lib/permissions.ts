/**
 * Permission system — role-based access control.
 *
 * Agent: define your actions and permission matrix here.
 *
 * 1. Define an Action type with all permissioned operations.
 * 2. Create PERMISSION_MATRIX mapping each role to its allowed actions.
 * 3. Use can(role, action) everywhere to check permissions.
 */

export type Action =
  | "view_dashboard"
  | "manage_system"
  | "manage_work_orders"
  | "report_production"
  | "review_quality";

export const PERMISSION_MATRIX: Record<string, Action[]> = {
  admin: [
    "view_dashboard",
    "manage_system",
    "manage_work_orders",
    "report_production",
    "review_quality",
  ],
};

/** Check whether a role is allowed to perform an action. */
export function can(role: string, action: Action): boolean {
  const allowed = PERMISSION_MATRIX[role];
  if (!allowed) return false;
  return allowed.includes(action);
}
