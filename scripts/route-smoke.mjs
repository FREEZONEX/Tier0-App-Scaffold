import { pathToFileURL } from "node:url";
import {
  defaultModules,
  validateNavigationModules,
} from "../src/components/shell-modules.ts";

const DEFAULT_PATHS = ["/"];
const FAILURE_TEXT = [
  "Page failed to load",
  "Application error",
  "Internal Server Error",
];
const DEFAULT_GATEWAY_HEADERS = {
  "X-App-User-ID": "preview-admin",
  "X-App-User-Name": "Preview Admin",
  "X-App-User-Email": "preview-admin@example.com",
  "X-Tier0-Runtime": "preview",
  "X-Tier0-Preview-Role": "admin",
};
const MAX_AUTH_REDIRECTS = 3;

export function evaluateSmokeResponse({ path, status, body }) {
  if (status < 200 || status >= 400) {
    return {
      ok: false,
      message: `${path} returned HTTP ${status}`,
    };
  }

  const matched = FAILURE_TEXT.find((text) => body.includes(text));
  if (matched) {
    return {
      ok: false,
      message: `${path} rendered failure text: ${matched}`,
    };
  }

  return { ok: true, message: `${path} loaded` };
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function normalizePath(value) {
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

export function buildSmokePaths(pathArgs = [], modules = defaultModules) {
  const navigationPaths = validateNavigationModules(modules).map(
    ({ href }) => href,
  );

  return [
    ...new Set(
      [...DEFAULT_PATHS, ...navigationPaths, ...pathArgs].map(normalizePath),
    ),
  ];
}

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${error.message}`);
  }
}

function resolveRedirectUrl(currentUrl, location) {
  return new URL(location, currentUrl).toString();
}

function buildSmokeHeaders(extraHeaders = {}) {
  return {
    accept: "text/html,*/*",
    ...DEFAULT_GATEWAY_HEADERS,
    ...extraHeaders,
  };
}

export async function smokePath(baseUrl, path, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const extraHeaders = options.headers ?? {};

  let url = `${baseUrl}${path}`;
  let response;

  for (let attempt = 0; attempt <= MAX_AUTH_REDIRECTS; attempt += 1) {
    response = await fetchImpl(url, {
      headers: buildSmokeHeaders(extraHeaders),
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = resolveRedirectUrl(url, location);
      continue;
    }

    break;
  }

  const body = await response.text();
  return evaluateSmokeResponse({
    path,
    status: response.status,
    body,
  });
}

async function main() {
  const [baseUrlArg, ...pathArgs] = process.argv.slice(2);
  const baseUrl = baseUrlArg || process.env.SMOKE_BASE_URL;

  if (!baseUrl) {
    console.error(
      "Usage: npm run smoke:routes -- http://127.0.0.1:5173 [/path ...]",
    );
    process.exitCode = 1;
    return;
  }

  const paths = buildSmokePaths(pathArgs);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const headers = parseJsonEnv("SMOKE_HEADERS");
  const failures = [];

  for (const path of paths) {
    try {
      const result = await smokePath(normalizedBaseUrl, path, {
        headers,
      });
      console.log(`[smoke] ${result.ok ? "ok" : "fail"} ${result.message}`);
      if (!result.ok) failures.push(result.message);
    } catch (error) {
      const message = `${path} failed to fetch: ${error.message}`;
      console.error(`[smoke] fail ${message}`);
      failures.push(message);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
