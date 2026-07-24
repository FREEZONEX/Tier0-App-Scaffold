import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import routerPlugin from "@tanstack/eslint-plugin-router";
import globals from "globals";

function staticName(node) {
  if (!node) return null;
  if (node.type === "Identifier" || node.type === "JSXIdentifier") {
    return node.name;
  }
  return null;
}

function isNullReturn(statement) {
  if (statement?.type === "ReturnStatement") {
    return statement.argument?.type === "Literal" && statement.argument.value === null;
  }
  return (
    statement?.type === "BlockStatement" &&
    statement.body.length === 1 &&
    isNullReturn(statement.body[0])
  );
}

function returnsJsx(statement) {
  if (statement?.type === "ReturnStatement") {
    return (
      statement.argument?.type === "JSXElement" ||
      statement.argument?.type === "JSXFragment"
    );
  }
  return (
    statement?.type === "BlockStatement" &&
    statement.body.length === 1 &&
    returnsJsx(statement.body[0])
  );
}

const runtimeFirstLoadRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Keep generated data loading and runtime seed initialization fail-safe",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename().replaceAll("\\", "/");
    const sourceCode = context.sourceCode;
    const isDataUiFile = /\/src\/(?:components|routes)\//.test(filename);
    const isServiceFile = /\/src\/services\//.test(filename);
    let requestCount = 0;
    let asyncViewCount = 0;
    let seedCount = 0;
    let bootstrapCount = 0;

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "Identifier") return;
        if (callee.name === "useRequest" && isDataUiFile) requestCount += 1;
        if (callee.name === "bootstrapModule" && isServiceFile) bootstrapCount += 1;
      },

      JSXOpeningElement(node) {
        if (staticName(node.name) === "AsyncView") asyncViewCount += 1;
      },

      IfStatement(node) {
        if (
          !isDataUiFile ||
          node.test.type !== "UnaryExpression" ||
          node.test.operator !== "!" ||
          node.test.argument.type !== "Identifier" ||
          node.test.argument.name !== "data" ||
          !isNullReturn(node.consequent)
        ) {
          const loadingName =
            node.test.type === "Identifier"
              ? node.test.name
              : node.test.type === "MemberExpression" &&
                  !node.test.computed &&
                  node.test.property.type === "Identifier"
                ? node.test.property.name
                : null;
          if (
            isDataUiFile &&
            /^(?:is)?loading$/i.test(loadingName ?? "") &&
            returnsJsx(node.consequent)
          ) {
            context.report({
              node,
              message:
                "Do not hand-render a full-page loading-only return. Use useRequest with <AsyncView> so a failed first request becomes a visible error with retry instead of an infinite loading screen.",
            });
          }
          return;
        }

        context.report({
          node,
          message:
            "Do not use if (!data) return null as a loading state; render the request through <AsyncView> so errors and empty data stay visible.",
        });
      },

      Property(node) {
        if (!isServiceFile || staticName(node.key) !== "seed") return;
        seedCount += 1;

        if (
          node.value.type !== "ArrowFunctionExpression" &&
          node.value.type !== "FunctionExpression"
        ) {
          context.report({
            node,
            message:
              "Runtime seed callbacks must be inline functions so the idempotency contract can be checked.",
          });
          return;
        }

        const seedBody = sourceCode.getText(node.value.body);
        if (!/\bonConflictDo(?:Update|Nothing)\s*\(/.test(seedBody)) {
          context.report({
            node,
            message:
              "Runtime seed callbacks must use onConflictDoUpdate() or onConflictDoNothing().",
          });
        }
        if (/\bdb\s*\.\s*(?:insert|update|delete)\s*\(/.test(seedBody)) {
          context.report({
            node,
            message:
              "Runtime seed callbacks must write through the transactional tx, not the shared db client.",
          });
        }
        if (
          /\btx\s*\.\s*execute\s*\(\s*sql\s*`[\s\r\n]*(?:insert|update|delete)\b/i.test(
            seedBody,
          ) ||
          /\btx\s*\.\s*execute\s*\(\s*sql\s*\.\s*raw\s*\(\s*["'`][\s\r\n]*(?:insert|update|delete)\b/i.test(
            seedBody,
          )
        ) {
          context.report({
            node,
            message:
              "Runtime seed writes must use typed tx.insert()/update()/delete() builders, not raw SQL. Typed builders apply the schema's date/timestamp encoders before values reach PostgreSQL.",
          });
        }
        if (/\.\s*set(?:UTC)?Date\s*\(|\.\s*setTime\s*\(/.test(seedBody)) {
          context.report({
            node,
            message:
              "Do not construct runtime seed values with mutating Date setters, which return numbers. Use seedDate() for date columns and seedTimestamp() for timestamp columns.",
          });
        }
      },

      "Program:exit"(node) {
        if (isDataUiFile && requestCount > 0 && asyncViewCount === 0) {
          context.report({
            node,
            message:
              "Files using useRequest must render the result through <AsyncView>.",
          });
        }
        if (isServiceFile && seedCount > 0 && bootstrapCount === 0) {
          context.report({
            node,
            message:
              "Runtime seed callbacks must be owned by bootstrapModule().",
          });
        }
      },
    };
  },
};

const eslintConfig = defineConfig([
  globalIgnores([
    ".output/**",
    "dist/**",
    "build/**",
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
      "tier0-runtime": { rules: { "first-load": runtimeFirstLoadRule } },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "tier0-runtime/first-load": "error",
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
