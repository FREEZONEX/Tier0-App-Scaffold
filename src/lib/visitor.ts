/**
 * Who is calling: the `X-Tier0-Visitor` header the front door sets on every
 * request. It is the only source of identity. The front door strips every
 * `X-Tier0-*` the client sent before it adds this one, and it is the only way
 * into the App, so the header is plain (unsigned) JSON; the SDK parses it
 * strictly and checks that it names this App. The App reads no other identity
 * header and keeps no session.
 *
 * The visitor's `appRoles` are what the App's own rules work with: the
 * platform calls the App makes are the App's own and carry no visitor, so
 * deciding what the current user may see or change is up to the App's
 * services (`src/lib/auth.ts`, `src/lib/permissions.ts`).
 *
 * Under `vite dev` outside the platform, `vite.config.ts` sets the header for
 * `PREVIEW_USER_ID`; it is then checked against `resolveAppId()`, which falls
 * back to the local placeholder. A production build checks it against the
 * platform-injected App ID, read by the SDK, and refuses to run without it.
 */
import { parseVisitorHeader, VISITOR_HEADER, VisitorError, type Visitor } from "@tier0/sdk-v2/server";
import { resolveAppId } from "./app-id";

export type { Visitor };

/** The App the header must name; `undefined` lets the SDK require the platform-injected App ID. */
function expectedAppId(): string | undefined {
  return import.meta.env?.DEV && process.env.NODE_ENV !== "production" ? resolveAppId() : undefined;
}

/**
 * The visitor of a request, or null when there is none or its header is
 * invalid. Without the platform-injected App ID it throws: that is a platform
 * fault, not an anonymous caller.
 */
export function readVisitor(headers: Headers): Visitor | null {
  const value = headers.get(VISITOR_HEADER);
  if (!value) return null;
  try {
    return parseVisitorHeader(value, { appID: expectedAppId() });
  } catch (error) {
    if (error instanceof VisitorError && error.code === "VISITOR_HEADER_INVALID") return null;
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
