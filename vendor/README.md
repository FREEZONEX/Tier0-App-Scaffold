# Matched Cloud App SDK candidate archives

These immutable local candidates are bound to actual checked source commits;
neither is an npm publication or a live deployment claim.

| Package | Source commit | Local archive |
|---|---|---|
| `@tier0/sdk@0.5.5` | `9525f893b80cf4778f7f30e172f4f13c701a1787` | `tier0-sdk-0.5.5-9525f893b80c.tgz` |
| `@tier0/sdk-v2@0.7.2` | `506c532b66973cc1b16dacd0e7d097800b65decd` | `tier0-sdk-v2-0.7.2-506c532b6697.tgz` |

Canonical SHA256: `c0ec923cfab558a00be1e6806e729c3b342f27ad6a0aa2c5f29ba7f4cdd9f00d` (335533 bytes).
SHA512 SRI: `sha512-iyZuZV3FmYpeNQGSIlGllzRDpB/7tmd8E7IjznMg5S1fImWVcm1DK1KaOjfI7EJOCytukerOWOWLEVg2YrCuSw==`.
Data SDK SHA256: `3634d19d0885f47fb02f7d2c38f2b740d519f2f79fa3a88a1f2bbc9ed98dbd19` (592033 bytes).
SHA512 SRI: `sha512-MJaWWkx8OM3Jbg74ewanqDq3ThiTrzF4IrRa+AurB4q5p56K8q5p3w+gCs0RzPGlue/Hf+5lNX/JMCFKplwfsw==`.

Both use Backend producer `397ac88a89593872cf76ad579a3c59753d832668`.
The canonical UNS types include required AppContext.dataState and optional
Stream run diagnostics. Its unchanged V1 projection retains actual 0b provenance.
Public-input equivalence does not relabel old archives. Keep 6367/0.5.4,
0.7.0 and 0.7.1 archives unchanged as historical checkpoints.

Canonical streams.requests/messages remain the sole App request/message API;
the Data SDK does not supply another execution API. StreamRequestError's
outcomeUnknown boolean is an SDK classifier, not a wire execution phase or
safe-replay promise. Requests retain one POST, retryable=false and no automatic
retry; no V1 execution/retry/phase fields are invented.

App policy and persisted Key scope ceilings still apply. Package gates do not
migrate old callers/Keys or prove runtime/broker/live readiness. Actual caller
inventory, owner-scoped credential migration, configuration/schema/backup and
real acceptance remain release gates. SWE d20 AppUser bridge is source in open
PR734, not evidence of ACK deployment or inclusion in MCP5088. Never add
Control aliases, browser keys or an automatic replay path. Retain these exact
archives in source/template ZIPs; do not replace them with same-version registry packages.
