import { createHmac } from "node:crypto";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const allowAllHosts = process.env.VITE_ALLOWED_HOSTS === "all";
const strictPort = process.env.VITE_STRICT_PORT !== "false";

function encodePreviewSession(payload: unknown, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

function previewGatewayHeaders(): Plugin {
  const previewUserId = process.env.PREVIEW_USER_ID;
  const previewUserName = process.env.PREVIEW_USER_NAME || previewUserId;
  const previewUserEmail = process.env.PREVIEW_USER_EMAIL || "";
  const previewUserRole = process.env.PREVIEW_USER_ROLE || "";
  const sessionSecret = process.env.SESSION_SECRET;
  const previewSession =
    previewUserId && previewUserRole && sessionSecret
      ? encodePreviewSession(
          {
            userId: previewUserId,
            role: previewUserRole,
            username: previewUserName,
            displayName: previewUserName,
            email: previewUserEmail || undefined,
          },
          sessionSecret,
        )
      : null;

  return {
    name: "preview-gateway-headers",
    configureServer(server) {
      if (!previewUserId) return;

      server.middlewares.use((req, _res, next) => {
        req.headers["x-app-user-id"] ??= previewUserId;
        if (previewUserName) {
          req.headers["x-app-user-name"] ??= previewUserName;
        }
        if (previewUserEmail) {
          req.headers["x-app-user-email"] ??= previewUserEmail;
        }
        if (previewUserRole) {
          req.headers["x-app-user-role"] ??= previewUserRole;
        }
        if (previewSession && !req.headers.cookie?.includes("mes-session=")) {
          const existingCookies = req.headers.cookie?.trim();
          req.headers.cookie = existingCookies
            ? `${existingCookies}; mes-session=${previewSession}`
            : `mes-session=${previewSession}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "/",
  server: {
    port: 5173,
    strictPort,
    host: "0.0.0.0",
    allowedHosts: allowAllHosts ? true : [],
    forwardConsole: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    external: ["pg", "@tier0/sdk", "mqtt"],
  },
  optimizeDeps: {
    include: [
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@tanstack/react-table",
      "lucide-react",
      "motion",
      "recharts",
    ],
  },
  plugins: [
    previewGatewayHeaders(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        basepath:
          process.env.VITE_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || undefined,
      },
    }),
    viteReact(),
  ],
});
