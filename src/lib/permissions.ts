/**
 * Permission system — role-based access control.
 *
 * Agent: define your actions and permission matrix here.
 *
 * 1. Define an Action type with all permissioned operations.
 * 2. Create PERMISSION_MATRIX mapping each role to its allowed actions.
 * 3. Use can(role, action) everywhere to check permissions.
 */

// ─── Agent: replace with your app's actions ───
// Example: type Action = "view_dashboard" | "create_order" | "approve_order" | "manage_equipment" | ...
export type Action = string;

// ─── Agent: replace with your role → actions mapping ───
// Example:
// export const PERMISSION_MATRIX: Record<string, Action[]> = {
//   admin: ["view_dashboard", "create_order", "approve_order", "manage_equipment"],
//   operator: ["view_dashboard", "create_order"],
//   viewer: ["view_dashboard"],
// };
export const PERMISSION_MATRIX: Record<string, Action[]> = {};

/** Check whether a role is allowed to perform an action. */
export function can(role: string, action: Action): boolean {
  const allowed = PERMISSION_MATRIX[role];
  if (!allowed) return false;
  return allowed.includes(action);
}
