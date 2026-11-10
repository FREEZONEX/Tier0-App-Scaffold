import { loadTier0Sdk, type Tier0Client } from "@/lib/tier0";
import type { AppUser } from "@/lib/users";

type ListWorkspaceMembers = Tier0Client["members"]["listWorkspace"];

/** Display metadata only. Identity and roles always remain the visitor's. */
export async function resolveUserDisplay(
  user: AppUser,
  listMembers: ListWorkspaceMembers,
  signal: AbortSignal,
): Promise<AppUser> {
  // The keyword matches IDs as well as names. Still require an exact ID match:
  // another member's name can contain this user's ID, including on earlier pages.
  const size = 100;
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const result = await listMembers({ keyword: user.id, page, size }, { signal });
    const member = result.list.find((entry) => entry.userId === user.id);
    if (member) {
      const username = member.userName?.trim();
      const displayName = member.nickName?.trim() || username;
      return displayName
        ? { ...user, username: username || displayName, displayName }
        : user;
    }
    if (result.list.length === 0 || page * size >= Number(result.total)) {
      return user;
    }
  }
}

/** Resolve the authenticated caller's own name without making login depend on it. */
export async function withUserDisplay(user: AppUser | null): Promise<AppUser | null> {
  if (!user) return null;
  try {
    const { createClient } = await loadTier0Sdk();
    const client = createClient();
    // A single deadline covers all pages; no process-wide name/session cache.
    return await resolveUserDisplay(user, client.members.listWorkspace, AbortSignal.timeout(2000));
  } catch {
    // SDK errors can contain platform details. Report the failure without
    // logging the response, member list, credentials, or user identity.
    console.error("[user-display] Platform name unavailable; using visitor ID.");
    return user;
  }
}
