/**
 * Production Node.js server entry.
 *
 * TanStack Start's Vite build emits a fetch-style handler at
 * `dist/server/server.js` (default export = `{ fetch }`). This file wraps
 * that handler with `node:http` to listen on a port and to serve the static
 * client assets from `dist/client/`.
 *
 * Run via `npm start` (which is `node server.mjs`).
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, extname, join, normalize } from "node:path";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, "dist", "client");
const SERVER_ENTRY = pathToFileURL(
  join(__dirname, "dist", "server", "server.js"),
).href;

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || process.env.HOSTNAME || "0.0.0.0";

const MIME_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const handlerModule = await import(SERVER_ENTRY);
const handler = handlerModule.default;
if (!handler || typeof handler.fetch !== "function") {
  throw new Error(
    "dist/server/server.js does not export a default { fetch } handler. " +
      "Did `vite build` succeed?",
  );
}

function nodeRequestToWebRequest(req, baseUrl) {
  const url = new URL(req.url, baseUrl);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else if (v != null) headers.set(k, v);
  }
  const init = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const url = new URL(req.url, "http://x");
  let p = decodeURIComponent(url.pathname);
  if (p.includes("..")) return false;
  // Only serve known client assets to avoid leaking arbitrary files.
  const candidates = [];
  if (p === "/" || p === "") candidates.push(null); // fall through to SSR
  if (p.startsWith("/assets/")) candidates.push(join(CLIENT_DIR, p));
  if (p === "/favicon.ico") candidates.push(join(CLIENT_DIR, "favicon.ico"));
  if (/\.(woff2?|ttf|otf|png|jpe?g|svg|webp|ico)$/.test(p)) {
    candidates.push(join(CLIENT_DIR, p));
  }
  for (const file of candidates) {
    if (!file) continue;
    const safe = normalize(file);
    if (!safe.startsWith(CLIENT_DIR)) continue;
    try {
      const s = await stat(safe);
      if (!s.isFile()) continue;
      const data = await readFile(safe);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(safe)] || "application/octet-stream",
        "Content-Length": data.length,
      });
      res.end(data);
      return true;
    } catch {
      // not found, try next
    }
  }
  return false;
}

const server = createServer(async (req, res) => {
  try {
    if (await tryServeStatic(req, res)) return;
    const baseUrl = `https://${req.headers.host || `${HOST}:${PORT}`}`;
    const webReq = nodeRequestToWebRequest(req, baseUrl);
    const webRes = await handler.fetch(webReq);
    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => res.setHeader(key, value));
    if (webRes.body) {
      Readable.fromWeb(webRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[server.mjs] request failed:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`▲ TanStack Start server listening on http://${HOST}:${PORT}`);
});
