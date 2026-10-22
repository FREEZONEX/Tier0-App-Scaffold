import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DATA_UI_ROOTS = ["src/components", "src/routes"];
const SERVICE_ROOT = "src/services";

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function walkFiles(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const findings = [];

for (const root of DATA_UI_ROOTS) {
  for (const file of walkFiles(root)) {
    const source = stripComments(readFileSync(file, "utf8"));
    const rel = toPosixPath(relative(process.cwd(), file));
    if (/\bif\s*\(\s*!\s*data\s*\)\s*(?:\{\s*)?return\s+null\s*;?/.test(source)) {
      findings.push(`${rel}: fake loading guard (if (!data) return null)`);
    }
    if (/\buseRequest\s*\(/.test(source) && !/<AsyncView\b/.test(source)) {
      findings.push(`${rel}: useRequest result is not rendered through <AsyncView>`);
    }
    if (
      /\bif\s*\(\s*(?:[A-Za-z_$][\w$]*\.)?(?:is)?loading\s*\)\s*(?:\{\s*)?return\s*(?:\(|<)/i.test(
        source,
      ) &&
      !/<AsyncView\b/.test(source)
    ) {
      findings.push(`${rel}: full-page loading return has no AsyncView error/retry state`);
    }
  }
}

// Services run on SSR startup paths: touching App data at import time would
// make every cold start depend on UNS. Data access starts inside a request.
for (const file of walkFiles(SERVICE_ROOT)) {
  const rel = toPosixPath(relative(process.cwd(), file));
  const source = stripComments(readFileSync(file, "utf8"));
  if (/^(?:export\s+)?(?:(?:const|let|var)\s+[\w${}[\],\s]+=\s*)?await\b/m.test(source)) {
    findings.push(`${rel}: top-level await runs at import time; access data inside the service function`);
  }
}

if (findings.length > 0) {
  console.error(`[runtime-audit] ${findings.length} first-load safety violation(s):`);
  for (const finding of findings) console.error(`[runtime-audit] ${finding}`);
  process.exit(1);
}

console.log("[runtime-audit] first-load safety audit passed");
