/**
 * AppUser type definition.
 *
 * Identity fields come from the gateway (user header).
 * Role is selected by the user on the login page.
 *
 * Strict — no index signature. Anything in the cookie payload that isn't
 * declared here will not flow into the typed user object.
 */

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email?: string;
}
