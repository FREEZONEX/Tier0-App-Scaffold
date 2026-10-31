import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AppUser } from "./users";
import { ROLE_REQUIRED_MESSAGE_PREFIX } from "./preview-bridge";
import { HttpError } from "./route-handlers";
import { hasAnyRole, toRoleList } from "./permissions";
import { readVisitor, visitorRoles, type Visitor } from "./visitor";

function toAppUser(visitor: Visitor): AppUser {
  const roles = toRoleList(visitorRoles(visitor));
  return {
    id: visitor.subject,
    // The token carries no name or email (access design 4.4). Use
    // `tier0.members` under `platform.users.read` where a name is needed.
    username: visitor.subject,
    displayName: visitor.subject,
    primaryRole: roles[0] ?? "",
    roles,
  };
}

/**
 * The current employee, from the verified visitor token. `app_roles` is the
 * complete role set and effective permissions are its union; in Preview it is
 * the developer's selected "view as" set. An empty set means zero permissions:
 * the scaffold reserves no fallback role. Machine callers are not users.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const visitor = readVisitor(new Headers(getRequestHeaders()));
  return visitor?.subType === "employee" ? toAppUser(visitor) : null;
}

/**
 * Require an authenticated user and, optionally, at least one required role.
 * Multiple assigned roles use union semantics: any matching role is enough.
 */
export async function requireAuth(...roles: string[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  if (roles.length > 0 && !hasAnyRole(user.roles, roles)) {
    throw new HttpError(
      403,
      `${ROLE_REQUIRED_MESSAGE_PREFIX} ${roles.join(" or ")}`,
    );
  }
  return user;
}

/** Require at least one of `roles`; an alias that reads better at the call site. */
export function requireRole(...roles: [string, ...string[]]): Promise<AppUser> {
  return requireAuth(...roles);
}
