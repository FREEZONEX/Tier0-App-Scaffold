/**
 * Who is calling: the visitor token the front door signs on every request
 * (`X-Tier0-Visitor`, access design 4.4). It is the only source of identity.
 * The App reads no plain identity header; verification fails closed.
 *
 * Keys come from `TIER0_JWKS_DIR`. Under `vite dev` the keys of the development
 * signer are accepted as well (`src/lib/dev-signer.ts`); a production build
 * never looks at them.
 */
import {
  createVisitorTokenVerifier,
  frontdoorKeysFromDir,
  parseVisitorJwks,
  VISITOR_TOKEN_HEADER,
  VisitorTokenError,
  type VerifiedVisitor,
} from "@tier0/sdk-v2/server";
import { resolveAppId } from "./app-id";

export type Visitor = VerifiedVisitor;

export const DEV_SIGNER_KEY = Symbol.for("tier0.scaffold.dev-signer-jwks");

type Verify = ReturnType<typeof createVisitorTokenVerifier>;

/** The development signer's public keys; undefined in every build. */
function devSignerKeys(): unknown {
  if (!import.meta.env?.DEV || process.env.NODE_ENV === "production") return undefined;
  return (globalThis as Record<symbol, unknown>)[DEV_SIGNER_KEY];
}

let cached: { dir: string; verify: Verify } | undefined;

function verifier(): Verify {
  const dir = process.env.TIER0_JWKS_DIR?.trim() ?? "";
  if (cached?.dir === dir) return cached.verify;
  const jwks = devSignerKeys();
  if (!dir && !jwks) throw new VisitorTokenError("VISITOR_TOKEN_CONFIGURATION_INVALID");
  const platform = dir ? frontdoorKeysFromDir(dir) : undefined;
  const verify = createVisitorTokenVerifier({
    ...(dir ? {} : { appID: resolveAppId() }),
    keys: {
      keys: () => new Map([...(platform?.keys() ?? []), ...(jwks ? parseVisitorJwks(jwks) : [])]),
    },
  });
  cached = { dir, verify };
  return verify;
}

/**
 * The verified visitor of a request, or null when there is none or its token
 * does not verify. A verifier that cannot run at all (no keys configured)
 * throws: that is a platform fault, not an anonymous caller.
 */
export function readVisitor(headers: Headers): Visitor | null {
  const token = headers.get(VISITOR_TOKEN_HEADER);
  if (!token) return null;
  try {
    return verifier()(token);
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
