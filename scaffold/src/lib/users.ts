/**
 * Static user registry for demo-grade authentication.
 *
 * Agent: define your users here. Each user needs at minimum:
 *   id, username, password, displayName, role
 * Add domain-specific fields as needed (department, shift, line, etc.).
 *
 * Provide at least 5 users covering all your defined roles.
 * Plain-text passwords are fine — this is demo auth, not production.
 */

export interface AppUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: string;
  [key: string]: unknown;
}

// ─── Agent: populate this array with your app's users ───
export const users: AppUser[] = [];

export function findUser(username: string, password: string): AppUser | null {
  return users.find((u) => u.username === username && u.password === password) ?? null;
}

export function getUserById(id: string): AppUser | null {
  return users.find((u) => u.id === id) ?? null;
}
