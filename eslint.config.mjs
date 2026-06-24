import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import routerPlugin from "@tanstack/eslint-plugin-router";
import globals from "globals";

const eslintConfig = defineConfig([
  globalIgnores([
    ".output/**",
    "dist/**",
    "build/**",
    "runtime/**",
    ".remember/**",
    ".superpowers/**",
    ".codegraph/**",
    "test-results/**",
    "playwright-report/**",
    "src/routeTree.gen.ts",
    "node_modules/**",
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@tanstack/router": routerPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // TypeScript already enforces undefined identifiers — disable the JS rule
      // so TS-aware namespaces (e.g. React.HTMLAttributes) don't false-positive.
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      // react-hooks v7 introduces several rules that flag pre-existing patterns
      // in the MES component library — keep them advisory rather than blocking
      // template builds. Agents should still address warnings opportunistically.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
    },
    settings: { react: { version: "detect" } },
  },
  // ─── Three-layer architecture enforcement ───
  // The `db` client must only be touched by services and the seed script.
  // Routes, lib, components, and start.ts must go through a service.
  // Schema (`@/db/schema`) and seed are not restricted — routes legitimately
  // import zod schemas from there.
  {
    files: [
      "src/routes/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/router.tsx",
      "src/start.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db",
              message:
                "The db client may only be imported from src/services/** or src/db/seed.ts. Move logic into a service and call it from here.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
