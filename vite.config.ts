import type { IncomingMessage } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { LOCAL_APP_ID } from "./src/lib/app-id";

const allowAllHosts = process.env.VITE_ALLOWED_HOSTS === "all";
const strictPort = process.env.VITE_STRICT_PORT !== "false";

/** `X-Tier0-Visitor` as the front door sets it: unpadded base64url of the visitor JSON. */
function visitorHeader(id: string, roles: readonly string[], appId: string): string {
  const visitor = {
    ws: process.env.TIER0_WORKSPACE_ID?.trim() || "1",
    app: appId,
    runtime: "preview",
    sub_type: "employee",
    sub: id,
    grant: "dev-grant",
    app_roles: roles,
    ...(roles[0] ? { active_role: roles[0] } : {}),
  };
  return Buffer.from(JSON.stringify(visitor)).toString("base64url");
}

/**
 * Sets or removes the visitor header in both views Node keeps of a request:
 * `headers.get()` reads `req.headers`, iterating the headers (e.g.
 * `new Headers(getRequestHeaders())`) reads `req.rawHeaders`.
 */
function setVisitorHeader(req: IncomingMessage, value: string | undefined): void {
  const raw = req.rawHeaders;
  for (let i = raw.length - 2; i >= 0; i -= 2) {
    if (raw[i].toLowerCase() === "x-tier0-visitor") raw.splice(i, 2);
  }
  if (value === undefined) {
    delete req.headers["x-tier0-visitor"];
    return;
  }
  req.headers["x-tier0-visitor"] = value;
  raw.push("X-Tier0-Visitor", value);
}

/**
 * Local stand-in for the front door under `vite dev`: sets the visitor header
 * for `PREVIEW_USER_ID` and answers `/__tier0/runtime.js`. Inside a platform
 * session (`TIER0_RUNTIME` is set) the real front door serves browsers, and
 * this only sets the header on loopback requests that came without one: the
 * agent's route smoke, which runs in the VM and never passes the front door.
 */
function devFrontDoor(): Plugin {
  const previewUserId = process.env.PREVIEW_USER_ID;
  const roles = (process.env.PREVIEW_USER_ROLE ?? "").split(",").map((role) => role.trim()).filter(Boolean);

  return {
    name: "dev-front-door",
    apply: "serve",
    configureServer(server) {
      const inSession = Boolean(process.env.TIER0_RUNTIME?.trim());
      const appId = process.env.TIER0_APP_ID?.trim() || process.env.APP_ID?.trim() || LOCAL_APP_ID;

      server.middlewares.use((req, res, next) => {
        if (inSession) {
          const loopback = /^(?:127\.|::1$|::ffff:127\.)/.test(req.socket.remoteAddress ?? "");
          if (loopback && !req.headers["x-tier0-visitor"]) {
            setVisitorHeader(req, visitorHeader(previewUserId || "preview-smoke", roles, appId));
          }
          next();
          return;
        }
        if (req.url?.split("?")[0] === "/__tier0/runtime.js") {
          res.setHeader("Content-Type", "text/javascript");
          res.end("");
          return;
        }
        setVisitorHeader(req, previewUserId ? visitorHeader(previewUserId, roles, appId) : undefined);
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
