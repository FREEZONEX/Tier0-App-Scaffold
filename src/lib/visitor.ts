/**
 * Who is calling: the visitor token the front door signs on every request
 * (`X-Tier0-Visitor`, access design 4.4). It is the only source of identity.
 * The App reads no plain identity header; verification fails closed.
 *
 * Keys come from the SDK's `frontdoorKeys()`: `TIER0_JWKS_DIR` when that
 * directory exists (platform sessions, where an agent writes the key file),
 * otherwise the front door's public JWKS at `TIER0_JWKS_URL` (published Apps).
 * The URL is fetched in the background; `visitorReady()` waits for the first
 * fetch, and until it has settled `readVisitor` refuses to run rather than
 * treat the caller as anonymous. Under `vite dev` the keys of the development
 * signer are accepted as well (`src/lib/dev-signer.ts`); a production build
 * never looks at them.
 */
import {
  createVisitorTokenVerifier,
  frontdoorKeys,
  parseVisitorJwks,
  VISITOR_TOKEN_HEADER,
  VisitorTokenError,
  type RefreshingVisitorKeySource,
  type VerifiedVisitor,
  type VisitorKeySource,
} from "@tier0/sdk-v2/server";
import { resolveAppId } from "./app-id";

export type Visitor = VerifiedVisitor;

export const DEV_SIGNER_KEY = Symbol.for("tier0.scaffold.dev-signer-jwks");

type Verify = ReturnType<typeof createVisitorTokenVerifier>;
/** The URL source adds `ready()` and `close()`; the directory source has neither. */
type PlatformKeys = VisitorKeySource & Partial<Pick<RefreshingVisitorKeySource, "ready" | "close">>;

interface Verifier {
  /** `TIER0_JWKS_DIR` and `TIER0_JWKS_URL` the verifier was built for. */
  config: string;
  verify: Verify;
  /** Settles once the platform keys can be used; at once without a URL source. */
  ready: Promise<void>;
  settled: boolean;
  close(): void;
}

/** The development signer's public keys; undefined in every build. */
function devSignerKeys(): unknown {
  if (!import.meta.env?.DEV || process.env.NODE_ENV === "production") return undefined;
  return (globalThis as Record<symbol, unknown>)[DEV_SIGNER_KEY];
}

let cached: Verifier | undefined;

function verifier(): Verifier {
  const dir = process.env.TIER0_JWKS_DIR?.trim() ?? "";
  const url = process.env.TIER0_JWKS_URL?.trim() ?? "";
  const config = `${dir}\n${url}`;
  if (cached?.config === config) return cached;
  const jwks = devSignerKeys();
  if (!dir && !url && !jwks) throw new VisitorTokenError("VISITOR_TOKEN_CONFIGURATION_INVALID");
  const platform: PlatformKeys | undefined = dir || url ? frontdoorKeys() : undefined;
  const dev = jwks ? parseVisitorJwks(jwks) : undefined;
  const verify = createVisitorTokenVerifier({
    ...(platform ? {} : { appID: resolveAppId() }),
    keys: {
      // The URL source's own map refreshes early on an unknown `kid`; hand it over as is when there is nothing to merge.
      keys: () => (dev ? new Map([...(platform?.keys() ?? []), ...dev]) : (platform?.keys() ?? new Map())),
    },
  });
  const next: Verifier = {
    config,
    verify,
    ready: Promise.resolve(),
    settled: !platform?.ready,
    close: () => platform?.close?.(),
  };
  // The SDK resolves it after the first fetch, successful or not; the fetch times out after 10 seconds.
  if (platform?.ready) next.ready = platform.ready().then(() => { next.settled = true; });
  cached?.close();
  cached = next;
  return next;
}

/**
 * Resolves once the visitor token can be verified: at once with
 * `TIER0_JWKS_DIR`, after the first fetch of `TIER0_JWKS_URL` (successful or
 * not, at most about 10 seconds) otherwise. Never rejects; a configuration
 * error surfaces in `readVisitor`. Await it before `readVisitor`.
 */
export async function visitorReady(): Promise<void> {
  let current: Verifier;
  try {
    current = verifier();
  } catch {
    return;
  }
  await current.ready;
}

/**
 * The verified visitor of a request, or null when there is none or its token
 * does not verify. A verifier that cannot run at all (no keys configured, or
 * the first key fetch has not settled: see `visitorReady`) throws: that is a
 * platform fault, not an anonymous caller.
 */
export function readVisitor(headers: Headers): Visitor | null {
  const token = headers.get(VISITOR_TOKEN_HEADER);
  if (!token) return null;
  try {
    const current = verifier();
    if (!current.settled) throw new VisitorTokenError("VISITOR_TOKEN_CONFIGURATION_INVALID");
    return current.verify(token);
  } catch (error) {
    if (error instanceof VisitorTokenError && error.code === "VISITOR_TOKEN_INVALID") return null;
    throw error;
  }
}

/**
 * Every role of the visitor, the active role first when it is one of them. The
 * active role is display metadata and grants nothing by itself.
 */
export function visitorRoles(visitor: Visitor): string[] {
  const { activeRole, appRoles } = visitor;
  return activeRole && appRoles.includes(activeRole)
    ? [activeRole, ...appRoles.filter((role) => role !== activeRole)]
    : [...appRoles];
}
