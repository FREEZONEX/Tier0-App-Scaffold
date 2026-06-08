---
name: build-post-verification
description: Enforce the required validation workflow after `npm run build` in this TanStack Start MES scaffold. Use when the user asks to add a mandatory post-build verification flow, strengthen build gates, reduce memory-leak regressions, or standardize what must pass after a frontend/backend build.
---

# Build Post Verification

## Purpose

Make `npm run build` insufficient on its own. In this scaffold, a successful
build must be followed by deterministic verification that catches the common
regressions generated apps introduce: request-loop leaks, overlapping polling,
missing listener cleanup, lint drift, and broken template contracts.

## Required Shape

- Keep the policy in this skill and the enforcement in npm lifecycle scripts.
- Use `postbuild` so every successful `npm run build` automatically runs the
  verifier.
- Keep the verifier deterministic and local. Do not depend on preview, browser
  automation, or network access for the required gate.

## Default Workflow

1. `npm run build`
2. npm lifecycle triggers `postbuild`
3. `postbuild` runs the local verifier script
4. The verifier must fail fast if any required check fails

## Required Checks

- Build output exists (`dist/client` and `dist/server`)
- TypeScript passes
- ESLint passes
- Template contract tests pass
- Runtime-safety checks pass:
  - no ad hoc repeated timers outside shared hooks
  - no listener add without same-file remove
  - no effect-driven fetch loop pattern without `useRequest`/`usePolling` or explicit abort cleanup

## Files

- Script: `scripts/post-build-verify.mjs`
- Runtime contracts: `src/lib/runtime-safety.test.mjs`

## When Extending

- Add new deterministic checks to the verifier or a contract test.
- Do not add slow, flaky, or environment-dependent steps to the mandatory gate.
- If a deeper manual investigation is needed, keep that as a separate workflow,
  not part of the required `postbuild` gate.
