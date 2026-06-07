import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(process.cwd(), "node_modules", "@tier0", "sdk");
const packageJsonPath = join(packageRoot, "package.json");
const runtimeFiles = [
  join(packageRoot, "dist", "openapi", "client.js"),
  join(packageRoot, "dist", "mq", "client.js"),
];

function patchPackageJson() {
  if (!existsSync(packageJsonPath)) return false;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (packageJson.type === "commonjs") return false;

  packageJson.type = "commonjs";
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  return true;
}

function patchRuntimeFile(filePath) {
  if (!existsSync(filePath)) return false;

  const source = readFileSync(filePath, "utf8");
  if (!source.includes("import.meta")) return false;

  const patched = source.replaceAll("import.meta", "undefined");
  writeFileSync(filePath, patched);
  return true;
}

const changed = [patchPackageJson(), ...runtimeFiles.map(patchRuntimeFile)].some(Boolean);

if (changed) {
  console.log("patched @tier0/sdk CommonJS runtime for Node 22");
}
