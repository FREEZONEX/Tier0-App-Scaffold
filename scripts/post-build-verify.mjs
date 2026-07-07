import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const steps = [
  {
    label: "Verify build artifacts",
    run() {
      const required = ["dist/client", "dist/server"];
      const missing = required.filter((path) => !existsSync(path));
      if (missing.length > 0) {
        throw new Error(`Missing build output: ${missing.join(", ")}`);
      }
    },
  },
  {
    label: "TypeScript",
    command: ["npm", "run", "typecheck"],
  },
  {
    label: "ESLint",
    command: ["npm", "run", "lint"],
  },
  {
    label: "Contract tests",
    command: [
      "node",
      "--test",
      "src/lib/permissions.test.mjs",
      "src/lib/app-chrome.test.mjs",
      "src/lib/button-contracts.test.mjs",
      "src/lib/form-contracts.test.mjs",
      "src/lib/overlay-contracts.test.mjs",
      "src/lib/interaction-contracts.test.mjs",
      "src/lib/table-contracts.test.mjs",
      "src/lib/copy-contracts.test.mjs",
      "src/lib/db-contracts.test.mjs",
      "src/lib/route-smoke-contracts.test.mjs",
      "src/lib/hooks-contracts.test.mjs",
      "src/lib/runtime-safety.test.mjs",
    ],
  },
  {
    label: "UI advisories (non-blocking)",
    command: ["node", "scripts/ui-advisories.mjs"],
  },
];

function resolveCommand(command) {
  if (process.platform === "win32" && command === "npm") {
    const npmCli = join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
    if (existsSync(npmCli)) {
      return { command: process.execPath, argsPrefix: [npmCli] };
    }
  }

  return { command, argsPrefix: [] };
}

for (const step of steps) {
  console.log(`\n[postbuild] ${step.label}`);

  if ("run" in step) {
    step.run();
    console.log("[postbuild] ok");
    continue;
  }

  const [command, ...args] = step.command;
  const resolved = resolveCommand(command);
  const result = spawnSync(resolved.command, [...resolved.argsPrefix, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[postbuild] failed to start ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log("[postbuild] ok");
}

console.log("\n[postbuild] build verification passed");
