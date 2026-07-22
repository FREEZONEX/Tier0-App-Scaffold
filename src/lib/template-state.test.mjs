import { describe } from "node:test";

// TEMPLATE-STATE ASSERTIONS — the one contract file generated apps ADAPT.
//
// This file asserts the scaffold's blank-template condition. When you build a
// real application these assertions become wrong BY DESIGN: replace them with
// assertions that describe the app you actually built (its navigation modules,
// its home route), or empty the describe block if there is nothing worth
// pinning. Every other test file is a locked invariant gate — see AGENTS.md
// "Locked gates vs template-state tests" — enforced by
// scripts/gate-integrity.mjs. This file is deliberately NOT hash-pinned.
//
// This SCADA product branch replaced the blank scaffold home route with its
// own HMI page (src/routes/index.tsx) and does not use the generic `_app`
// workspace layout — nothing left here to pin.
describe("template state (adapt when building the real app)", () => {});
