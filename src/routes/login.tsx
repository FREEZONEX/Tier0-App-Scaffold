/**
 * Hidden authentication error bridge.
 *
 * The platform Gateway owns authentication and role selection. The App does
 * not mint a local session or render a role picker.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { sendPreviewError } from "@/lib/preview-bridge";

export const Route = createFileRoute("/login")({
  component: LoginBridge,
});

function LoginBridge() {
  useEffect(() => {
    sendPreviewError('Platform authentication required', 'auth');
  }, []);
  return null;
}
