/**
 * AppUser type definition.
 *
 * Identity comes from the gateway (user header).
 * Role is selected by the user on the login page.
 */

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email?: string;
  [key: string]: unknown;
}
