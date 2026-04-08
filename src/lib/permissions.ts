/**
 * Permission system — role-based access control.
 */

export type Action =
  | "view_dashboard"
  | "work_centers:read"
  | "work_centers:write"
  | "work_centers:delete"
  | "items:read"
  | "items:write"
  | "items:delete"
  | "equipment:read"
  | "equipment:write"
  | "equipment:delete"
  | "work_orders:read"
  | "work_orders:write"
  | "work_orders:delete"
  | "operations:read"
  | "operations:write"
  | "quality:read"
  | "quality:write"
  | "inventory:read"
  | "inventory:write";

const allActions: Action[] = [
  "view_dashboard",
  "work_centers:read",
  "work_centers:write",
  "work_centers:delete",
  "items:read",
  "items:write",
  "items:delete",
  "equipment:read",
  "equipment:write",
  "equipment:delete",
  "work_orders:read",
  "work_orders:write",
  "work_orders:delete",
  "operations:read",
  "operations:write",
  "quality:read",
  "quality:write",
  "inventory:read",
  "inventory:write",
];

const readOnly: Action[] = [
  "view_dashboard",
  "work_centers:read",
  "items:read",
  "equipment:read",
  "work_orders:read",
  "operations:read",
  "quality:read",
  "inventory:read",
];

const operatorActions: Action[] = Array.from(
  new Set<Action>([
    ...readOnly,
    "work_orders:write",
    "operations:write",
    "quality:write",
  ]),
);

const supervisorActions: Action[] = allActions.filter(
  (a) =>
    a !== "work_centers:delete" &&
    a !== "equipment:delete" &&
    a !== "items:delete",
);

export const PERMISSION_MATRIX: Record<string, Action[]> = {
  admin: allActions,
  supervisor: supervisorActions,
  operator: operatorActions,
  viewer: readOnly,
};

export function can(role: string, action: Action): boolean {
  const allowed = PERMISSION_MATRIX[role];
  if (!allowed) return false;
  return allowed.includes(action);
}
