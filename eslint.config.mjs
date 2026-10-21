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
      description: "Keep generated data loading fail-safe",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename().replaceAll("\\", "/");
    const isDataUiFile = /\/src\/(?:components|routes)\//.test(filename);
    let requestCount = 0;
    let asyncViewCount = 0;

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "Identifier") return;
        if (callee.name === "useRequest" && isDataUiFile) requestCount += 1;
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

      "Program:exit"(node) {
        if (isDataUiFile && requestCount > 0 && asyncViewCount === 0) {
          context.report({
            node,
            message:
              "Files using useRequest must render the result through <AsyncView>.",
          });
        }
      },
    };
  },
};

// Data-layer calls are HTTP round trips to Tier0 UNS. One per loop iteration
// (or per item of map/forEach) multiplies latency and partial-failure states;
// batch writes and `$in` reads cover these cases. The batch calls themselves
// (insertMany, bulkWrite, data.transact) take ≤200 items, so looping over
// 200-item chunks of them is the intended pattern and is not reported.
const DATA_METHODS = new Set([
  "insertOne",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOne",
  "findPage",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "countDocuments",
  "toArray",
]);
const LOOP_TYPES = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);
const ITERATION_METHODS = new Set(["map", "flatMap", "forEach", "reduce", "filter", "some", "every"]);

const dataAccessRule = {
  meta: {
    type: "problem",
    docs: { description: "Keep App data-layer calls out of loops" },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          !DATA_METHODS.has(callee.property.name)
        ) {
          return;
        }
        let child = node;
        for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
          const inLoopBody = LOOP_TYPES.has(parent.type) && parent.body === child;
          const inIteration =
            (child.type === "ArrowFunctionExpression" || child.type === "FunctionExpression") &&
            parent.type === "CallExpression" &&
            parent.arguments.includes(child) &&
            parent.callee.type === "MemberExpression" &&
            parent.callee.property.type === "Identifier" &&
            ITERATION_METHODS.has(parent.callee.property.name);
          if (inLoopBody || inIteration) {
            context.report({
              node,
              message:
                `Do not call the data layer (${callee.property.name}) once per loop iteration or per item: each call is a UNS round trip. ` +
                "Read with one `$in` filter, write with insertMany / updateMany / bulkWrite (chunks of ≤200), or combine steps in data.transact().",
            });
            return;
          }
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
      "tier0-runtime": {
        rules: { "first-load": runtimeFirstLoadRule, "data-access": dataAccessRule },
      },
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
  // The data layer (`@/lib/data`) is server-only and reached through
  // services. Routes, lib, components and declarations may import the pure
  // declaration helpers (`@/lib/data/define`) and `@/data/collections` only;
  // src/start.ts opens the request context.
  {
    files: [
      "src/routes/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/data/**/*.{ts,tsx}",
      "src/router.tsx",
    ],
    ignores: ["src/lib/data/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/lib/data(?:/(?!define$).*)?$",
              message:
                "The App data layer may only be used from src/services/**. Move the data access into a service and call it from here.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/start.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/lib/data(?:/(?!(?:define|context)$).*)?$",
              message: "src/start.ts only opens the data request context.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "tier0-runtime/data-access": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx,js,mjs}"],
    ignores: ["src/lib/data/**", "**/*.test.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\/openapi\\/v2|collections\\/(schema:replace|archive|restore)/]",
          message:
            "Do not call Tier0 UNS directly: use data.collection(...) from @/lib/data. schema:replace / archive / restore are worker operations through the tier0 MCP.",
        },
        {
          selector: "TemplateElement[value.raw=/\\/openapi\\/v2|collections\\/(schema:replace|archive|restore)/]",
          message:
            "Do not call Tier0 UNS directly: use data.collection(...) from @/lib/data. schema:replace / archive / restore are worker operations through the tier0 MCP.",
        },
      ],
    },
  },
]);

export default eslintConfig;
