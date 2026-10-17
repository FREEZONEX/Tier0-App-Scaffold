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
      description: "Keep generated data loading and app-collection seeding fail-safe",
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
    let defineCount = 0;

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "Identifier") return;
        if (callee.name === "useRequest" && isDataUiFile) requestCount += 1;
        if (callee.name === "defineAppCollection" && isServiceFile) defineCount += 1;
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
              "Seed callbacks must be inline functions so the idempotency contract can be checked.",
          });
          return;
        }

        const seedBody = sourceCode.getText(node.value.body);
        if (/\b(?:randomUUID|Math\.random|Date\.now)\s*\(/.test(seedBody)) {
          context.report({
            node,
            message:
              "Seed records need fixed ids so a retry or a second process gets 409 (already exists) instead of a duplicate. Do not generate ids with randomUUID()/Math.random()/Date.now() in a seed.",
          });
        }
        if (/\.\s*set(?:UTC)?Date\s*\(|\.\s*setTime\s*\(/.test(seedBody)) {
          context.report({
            node,
            message:
              "Do not construct seed values with mutating Date setters, which return numbers. Use seedDate(), seedTimestamp() or seedTimeMs() from @/services/seed-utils.",
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
        if (isServiceFile && seedCount > 0 && defineCount === 0) {
          context.report({
            node,
            message:
              "Seed callbacks must be owned by defineAppCollection() so they run once, against an ensured collection.",
          });
        }
      },
    };
  },
};

const DB_IMPORT_MESSAGE =
  "Apps have no database. Store the app's own data in app-owned UNS collections (defineAppCollection / ensureAppCollection from @/lib/uns.server, called from src/services/**); see docs/uns-data.md.";

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
  // ─── Data-layer boundary ───
  // Apps have no database: their own data lives in app-owned UNS collections
  // (`defineAppCollection` in @/lib/uns.server). Database drivers and ORMs are
  // banned everywhere; browser components must not import the server client
  // (they call the app's own API routes instead).
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pg", message: DB_IMPORT_MESSAGE },
            { name: "postgres", message: DB_IMPORT_MESSAGE },
            { name: "@/db", message: DB_IMPORT_MESSAGE },
          ],
          patterns: [
            { group: ["drizzle-orm", "drizzle-orm/*", "drizzle-kit", "drizzle-kit/*", "drizzle-zod", "@prisma/*", "prisma", "knex", "kysely", "typeorm", "sequelize", "mysql", "mysql2", "sqlite3", "better-sqlite3", "@/db/*"], message: DB_IMPORT_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pg", message: DB_IMPORT_MESSAGE },
            { name: "postgres", message: DB_IMPORT_MESSAGE },
            { name: "@/db", message: DB_IMPORT_MESSAGE },
            {
              name: "@/lib/uns.server",
              message:
                "@/lib/uns.server is server-only. Components call the app's own API routes (apiUrl('/api/...') via useRequest) and get live updates with useUnsChanges().",
            },
          ],
          patterns: [
            { group: ["drizzle-orm", "drizzle-orm/*", "drizzle-kit", "drizzle-kit/*", "drizzle-zod", "@prisma/*", "prisma", "knex", "kysely", "typeorm", "sequelize", "mysql", "mysql2", "sqlite3", "better-sqlite3", "@/db/*"], message: DB_IMPORT_MESSAGE },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
