/**
 * Hidden auth bridge.
 *
 * Reached only when the gateway supplied a user identity but no valid app
 * role for this specific project/session — e.g. someone viewing a deployment
 * they haven't been assigned a role on. Mints a permission-less guest session
 * (view-only, no `edit_mimic`) instead of granting real access, and redirects
 * back to the requested app path without rendering a role picker.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { parseGatewayUser } from "@/lib/gateway";
import { GUEST_ROLE } from "@/lib/permissions";
import { encodeSession } from "@/lib/session";

const SESSION_COOKIE = "mes-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const createGuestSession = createServerFn().handler(
  async (): Promise<boolean> => {
    const headers = new Headers(getRequestHeaders());
    const gatewayUser = parseGatewayUser(headers);
    if (!gatewayUser) {
      return false;
    }

    setCookie(
      SESSION_COOKIE,
      encodeSession({
        userId: gatewayUser.id,
        role: GUEST_ROLE,
        username: gatewayUser.name,
        displayName: gatewayUser.name,
        email: gatewayUser.email,
      }),
      {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_MAX_AGE,
      },
    );

    return true;
  },
);

function normalizeRedirectPath(from: string | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) {
    return "/";
  }
  if (from.startsWith("/login")) {
    return "/";
  }
  return from;
}

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    from: z.string().optional(),
  }),
  beforeLoad: async ({ search }) => {
    await createGuestSession();
    throw redirect({
      to: normalizeRedirectPath(search.from) as never,
    });
  },
  component: LoginBridge,
});

function LoginBridge() {
  return null;
}
