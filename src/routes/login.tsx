/**
 * Hidden auth bridge.
 *
 * The platform owns role selection. When the legacy `/login` fallback is hit,
 * this route creates an admin session from the gateway identity and redirects
 * back to the requested app path without rendering a role picker.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setCookie } from "@tanstack/react-start/server";
import { useEffect } from "react";
import { z } from "zod";
import { parseGatewayUser } from "@/lib/gateway";
import { sendPreviewError } from "@/lib/preview-bridge";
import { ADMIN_ROLE } from "@/lib/permissions";
import { encodeSession } from "@/lib/session";

const SESSION_COOKIE = "mes-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const createDefaultAdminSession = createServerFn().handler(
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
        role: ADMIN_ROLE,
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
    const ok = await createDefaultAdminSession();
    if (ok) {
      throw redirect({
        to: normalizeRedirectPath(search.from) as never,
      });
    }
  },
  component: LoginBridge,
});

function LoginBridge() {
  useEffect(() => {
    sendPreviewError('Platform authentication required', 'auth');
  }, []);
  return null;
}
