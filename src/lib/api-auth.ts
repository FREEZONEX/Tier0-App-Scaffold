import { getCurrentUser } from "@/lib/auth";
import { can, type Action } from "@/lib/permissions";
import type { AppUser } from "@/lib/users";

export async function requireSessionWithAction(
  action: Action,
): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw { status: 401, message: "Authentication required" };
  }
  if (!can(user.role, action)) {
    throw { status: 403, message: "Forbidden" };
  }
  return user;
}
