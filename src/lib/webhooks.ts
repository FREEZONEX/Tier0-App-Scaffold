/**
 * Routes that accept a `machine` visitor (a caller with an App call token).
 * Every other path refuses it. Mirrors the `[[webhooks]]` of `artifact.toml`,
 * which is what the front door admits; a contract test keeps them equal.
 */
export const WEBHOOK_PATHS: readonly string[] = [];

export function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PATHS.includes(pathname);
}
