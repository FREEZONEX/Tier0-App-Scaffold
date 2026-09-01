/**
 * `APP_ID` is a platform-owned runtime identifier: the agent-platform App UUID
 * (36 chars, the `apps.id` primary key), injected into Preview and deployed
 * runs. `/api/manifest` echoes it, and it is the identity the app uses wherever
 * it identifies itself to the platform (e.g. notification `sender.id`). It is
 * not the app's name or business identity.
 *
 * Always resolve it at runtime through this function — never hard-code the
 * value at generation time: an app imported into another project gets a new
 * UUID, and a hard-coded value keeps pointing at the source app.
 *
 * Without injection the app falls back to `LOCAL_APP_ID` — a local-development
 * placeholder that deliberately says so, instead of a value that could pass as
 * a real id and hide a missing platform variable.
 */
export const LOCAL_APP_ID = "local-app";

export function resolveAppId(env: NodeJS.ProcessEnv = process.env): string {
  return env.APP_ID?.trim() || LOCAL_APP_ID;
}
