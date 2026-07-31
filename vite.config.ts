import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const allowAllHosts = process.env.VITE_ALLOWED_HOSTS === "all";
const strictPort = process.env.VITE_STRICT_PORT !== "false";

function previewGatewayHeaders(): Plugin {
  const previewUserId = process.env.PREVIEW_USER_ID;
  const previewUserName = process.env.PREVIEW_USER_NAME || previewUserId;
  const previewUserEmail = process.env.PREVIEW_USER_EMAIL || "";
  const previewUserRole = process.env.PREVIEW_USER_ROLE || "";

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
        req.headers["x-tier0-runtime"] ??= "preview";
        if (previewUserRole) {
          req.headers["x-tier0-preview-role"] ??= previewUserRole;
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
    // Pre-bundle client deps that are only reached through code-split route
    // boundaries. If Vite discovers one of these *after* the initial scan it
    // re-optimizes and forces a full page reload, breaking HMR. List the exact
    // subpath that is actually imported (e.g. "motion/react", not "motion").
    include: [
      "lucide-react",
      "motion/react",
      "clsx",
      "tailwind-merge",
      "sonner",
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
