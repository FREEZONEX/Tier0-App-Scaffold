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

// Body of every `seed: () => …` callback (block, array or parenthesized literal).
function extractSeedBlocks(source) {
  const blocks = [];
  const seedPattern =
    /\bseed\s*:\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*([{[(])/g;
  const closers = { "{": "}", "[": "]", "(": ")" };

  for (const match of source.matchAll(seedPattern)) {
    const opener = match[1];
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let quote = null;
    let escaped = false;

    for (let index = openIndex; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === "'" || character === '"' || character === "`") {
        quote = character;
        continue;
      }
      if (character === opener) depth += 1;
      else if (character === closers[opener]) {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(openIndex, index + 1));
          break;
        }
      }
    }
  }
  return blocks;
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

// First-load seeds of app-owned collections: owned by defineAppCollection(),
// fixed record ids (a retry or a second process gets 409 instead of a
// duplicate), no numeric Date-setter results.
for (const file of walkFiles(SERVICE_ROOT)) {
  const rel = toPosixPath(relative(process.cwd(), file));
  const source = stripComments(readFileSync(file, "utf8"));
  const seedBlocks = extractSeedBlocks(source);
  if (seedBlocks.length === 0) continue;

  if (!/\bdefineAppCollection\s*(?:<[^>]*>)?\s*\(/.test(source)) {
    findings.push(`${rel}: seed callback is not owned by defineAppCollection`);
  }
  seedBlocks.forEach((seedBlock, index) => {
    if (/\b(?:randomUUID|Math\.random|Date\.now)\s*\(/.test(seedBlock)) {
      findings.push(
        `${rel}: seed callback ${index + 1} generates record ids at runtime; use fixed ids so re-seeding is idempotent`,
      );
    }
    if (/\.\s*set(?:UTC)?Date\s*\(|\.\s*setTime\s*\(/.test(seedBlock)) {
      findings.push(
        `${rel}: seed callback ${index + 1} uses a numeric Date setter result`,
      );
    }
  });
}

if (findings.length > 0) {
  console.error(`[runtime-audit] ${findings.length} first-load safety violation(s):`);
  for (const finding of findings) console.error(`[runtime-audit] ${finding}`);
  process.exit(1);
}

console.log("[runtime-audit] first-load safety audit passed");
