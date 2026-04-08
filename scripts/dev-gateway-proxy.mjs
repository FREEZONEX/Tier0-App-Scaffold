#!/usr/bin/env node
/**
 * Minimal local "gateway" — forwards HTTP + WebSocket to Next.js and injects the `user` header
 * so /login shows the platform user without a real gateway.
 *
 * Prerequisites: Next.js dev server running (default target port 3000).
 *
 * Usage (two terminals):
 *   npm run dev
 *   npm run dev:gateway
 *   → open http://localhost:3001
 *
 * Or one terminal (Next on 3101, proxy on 3000):
 *   npm run dev:with-gateway
 *   → open http://localhost:3000
 *
 * Env overrides:
 *   GATEWAY_LISTEN   — proxy listen port (default 3001 for dev:gateway, dev:with-gateway sets 3000)
 *   GATEWAY_TARGET   — Next.js origin (default http://127.0.0.1:3000)
 *   GATEWAY_USER_JSON — full JSON string for `user` header (default mercy user)
 */

import http from "node:http";
import httpProxy from "http-proxy";

const target = process.env.GATEWAY_TARGET || "http://127.0.0.1:3000";
const listenPort = Number(process.env.GATEWAY_LISTEN || "3001");
const userJson =
  process.env.GATEWAY_USER_JSON ||
  JSON.stringify({
    userID: "mercy-local-1",
    userName: "mercy",
    email: "mercy@example.com",
  });

const proxy = httpProxy.createProxyServer({
  target,
  ws: true,
  changeOrigin: true,
});

function attachUserHeader(req) {
  req.headers["user"] = userJson;
}

const server = http.createServer((req, res) => {
  attachUserHeader(req);
  proxy.web(req, res, { target }, (err) => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(
      `Bad gateway — is Next.js running at ${target}?\n${err?.message || err}`,
    );
  });
});

server.on("upgrade", (req, socket, head) => {
  attachUserHeader(req);
  proxy.ws(req, socket, head, { target });
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(
    `[gateway-proxy] http://localhost:${listenPort}  →  ${target}\n` +
      `[gateway-proxy] injecting header user: ${userJson}`,
  );
});
