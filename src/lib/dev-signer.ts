/**
 * Development signer: stands in for the front door under `vite dev` outside the
 * platform, so a local run has a visitor without any real credential. Loaded by
 * `vite.config.ts` only, never by App code.
 *
 * The key pair is generated at every start and lives in this process; its
 * public half goes on a process-wide symbol that `src/lib/visitor.ts` reads in
 * development only. A production build has neither, so a token signed here
 * means nothing there.
 */
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";

export interface DevVisitor {
  id: string;
  roles: readonly string[];
  appId: string;
  workspaceId?: string;
}

const TOKEN_TTL_SECONDS = 60;
const KEY_ID = "dev-signer";

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function createDevSigner() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    /** JWKS of this run. */
    jwks: { keys: [{ ...publicKey.export({ format: "jwk" }), kid: KEY_ID, alg: "EdDSA", use: "sig" }] },
    /** A preview visitor token for `visitor`, valid for one minute. */
    sign(visitor: DevVisitor): string {
      const now = Math.floor(Date.now() / 1000);
      const body = `${encode({ alg: "EdDSA", kid: KEY_ID })}.${encode({
        iss: "tier0-frontdoor",
        aud: `app:${visitor.appId}`,
        typ: "visitor",
        sub_type: "employee",
        sub: visitor.id,
        grant: "dev-grant",
        ws: visitor.workspaceId ?? "1",
        runtime: "preview",
        app_roles: visitor.roles,
        active_role: visitor.roles[0] ?? "",
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
        jti: randomUUID(),
      })}`;
      return `${body}.${sign(null, Buffer.from(body), privateKey).toString("base64url")}`;
    },
  };
}
