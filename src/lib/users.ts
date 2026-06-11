/**
 * AppUser type definition.
 *
 * Identity fields come from the gateway (user header).
 * Role comes from the gateway, the external role selector, or the admin default.
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
