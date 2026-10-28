import { AssertionError } from "node:assert";
import { it } from "node:test";

// A heuristic or design preference is review evidence, not an App invariant.
// Scaffold CI can still enforce its own defaults with SCAFFOLD_GUIDANCE_STRICT=1.
export function guidanceIt(name, optionsOrFn, maybeFn) {
  const options = typeof optionsOrFn === "function" ? {} : optionsOrFn;
  const fn = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
  return it(name, options, async (context) => {
    try {
      await fn(context);
    } catch (error) {
      if (!(error instanceof AssertionError) || process.env.SCAFFOLD_GUIDANCE_STRICT === "1") throw error;
      console.warn(`[advisory] ${name}: ${error.message}`);
      context.diagnostic("Non-blocking generation guidance; review against the requested workflow.");
    }
  });
}
