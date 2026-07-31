/**
 * AppUser type definition.
 *
 * Identity and roles come from the Tier0 Gateway headers.
 * Preview may use the scaffold admin default before a view-as role is selected.
 *
 * Strict — no index signature. Unknown gateway fields do not flow into the
 * typed user object.
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
