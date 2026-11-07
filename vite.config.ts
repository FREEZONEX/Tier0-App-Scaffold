import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { LOCAL_APP_ID } from "./src/lib/app-id";
import { createDevSigner } from "./src/lib/dev-signer";

// Same symbol as src/lib/visitor.ts; that module needs Vite's `import.meta.env`.
const DEV_SIGNER_KEY = Symbol.for("tier0.scaffold.dev-signer-jwks");

const allowAllHosts = process.env.VITE_ALLOWED_HOSTS === "all";
const strictPort = process.env.VITE_STRICT_PORT !== "false";

/**
 * Local stand-in for the front door under `vite dev`: signs a visitor token for
 * `PREVIEW_USER_ID` and answers `/__tier0/runtime.js`. Inside a platform
 * session (`TIER0_JWKS_DIR` is set) the real front door serves browsers, and
 * this only signs loopback requests that came without a token: the agent's
 * route smoke, which runs in the VM and never passes the front door.
 */
function devFrontDoor(): Plugin {
  const previewUserId = process.env.PREVIEW_USER_ID;
  const roles = (process.env.PREVIEW_USER_ROLE ?? "").split(",").map((role) => role.trim()).filter(Boolean);

  return {
    name: "dev-front-door",
    apply: "serve",
    configureServer(server) {
      const inSession = Boolean(process.env.TIER0_JWKS_DIR?.trim());
      const signer = createDevSigner();
      (globalThis as Record<symbol, unknown>)[DEV_SIGNER_KEY] = signer.jwks;
      const appId = process.env.TIER0_APP_ID?.trim() || process.env.APP_ID?.trim() || LOCAL_APP_ID;

      server.middlewares.use((req, res, next) => {
        if (inSession) {
          const loopback = /^(?:127\.|::1$|::ffff:127\.)/.test(req.socket.remoteAddress ?? "");
          if (loopback && !req.headers["x-tier0-visitor"]) {
            req.headers["x-tier0-visitor"] = signer.sign({ id: previewUserId || "preview-smoke", roles, appId });
          }
          next();
          return;
        }
        if (req.url?.split("?")[0] === "/__tier0/runtime.js") {
          res.setHeader("Content-Type", "text/javascript");
          res.end("");
          return;
        }
        if (previewUserId) req.headers["x-tier0-visitor"] = signer.sign({ id: previewUserId, roles, appId });
        else delete req.headers["x-tier0-visitor"];
        next();
      });
    },
  };
}

export default defineConfig({

  base: process.env.VITE_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "/",
  server: {
    watch: {
      // Sandbox session data is not application source. Ignoring it prevents
      // wire.jsonl appends from being amplified into full-page reloads.
      ignored: ["**/.tier0/**"],
    },
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
    external: ["@tier0/sdk-v2", "mqtt"],
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
      "@tier0/sdk-v2/event-stream",
      "@tier0/sdk-v2/page-runtime",
    ],
  },
  plugins: [
    devFrontDoor(),
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
