#!/usr/bin/env node
/**
 * Local static server for .output/component-gallery (component portal).
 * Usage: npm run gallery:serve
 *
 * Responses are sent with `Cache-Control: no-store` so a fresh
 * `npm run gallery:build` shows up on a plain reload; hashed asset names
 * change on every build and a cached preview.html would keep loading
 * assets that no longer exist.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, ".output/component-gallery");
const port = Number(process.env.GALLERY_PORT || 4335);
const host = process.env.GALLERY_HOST || "127.0.0.1";

if (!existsSync(join(dir, "index.html"))) {
  console.error(
    "Missing gallery build. Run: npm run gallery:build",
  );
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function resolveFile(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const target = normalize(join(dir, pathname));
  if (target !== dir && !target.startsWith(dir + sep)) return null;
  if (!existsSync(target)) return null;
  const stat = statSync(target);
  if (stat.isDirectory()) {
    const index = join(target, "index.html");
    return existsSync(index) ? index : null;
  }
  return target;
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url || "/");
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${port} is already in use.` : err);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log("");
  console.log("Component gallery:");
  console.log(`  http://${host}:${port}/index.html`);
  console.log(`  http://${host}:${port}/scaffold-library.html`);
  console.log("");
  console.log("Press Ctrl+C to stop.");
});
