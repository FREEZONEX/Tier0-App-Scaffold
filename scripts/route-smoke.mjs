import { pathToFileURL } from "node:url";

const DEFAULT_PATHS = ["/"];
const FAILURE_TEXT = [
  "Page failed to load",
  "Application error",
  "Internal Server Error",
];

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

async function smokePath(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "text/html,*/*" },
  });
  const body = await response.text();
  return evaluateSmokeResponse({ path, status: response.status, body });
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

  const paths = (pathArgs.length > 0 ? pathArgs : DEFAULT_PATHS).map(
    normalizePath,
  );
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const failures = [];

  for (const path of paths) {
    try {
      const result = await smokePath(normalizedBaseUrl, path);
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
