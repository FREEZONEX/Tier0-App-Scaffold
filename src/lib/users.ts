/**
 * AppUser type definition.
 *
 * Identity fields come from the gateway (user header).
 * Roles come from the gateway, the external role selector, or the admin default.
 *
 * Strict — no index signature. Anything in the cookie payload that isn't
 * declared here will not flow into the typed user object.
 */

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  /** Primary role is display metadata only. Never use it for authorization. */
  primaryRole: string;
  /** All assigned roles. Effective permissions are the union across this set. */
  roles: string[];
  email?: string;
}
