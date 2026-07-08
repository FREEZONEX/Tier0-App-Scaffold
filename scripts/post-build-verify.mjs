import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

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
      "src/lib/navigation-contracts.test.mjs",
      "src/lib/content-contracts.test.mjs",
      "src/lib/button-contracts.test.mjs",
      "src/lib/form-contracts.test.mjs",
      "src/lib/hooks-contracts.test.mjs",
      "src/lib/runtime-safety.test.mjs",
    ],
  },
];

for (const step of steps) {
  console.log(`\n[postbuild] ${step.label}`);

  if ("run" in step) {
    step.run();
    console.log("[postbuild] ok");
    continue;
  }

  const [command, ...args] = step.command;
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log("[postbuild] ok");
}

console.log("\n[postbuild] build verification passed");
