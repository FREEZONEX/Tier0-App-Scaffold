# Role Registration — Conventions and Handoff Guide

This document is the single source of truth for how business roles flow between
the platform (UNS-SWE) and this app. Read it before adding, renaming, or
removing any role. It exists so an agent picking up unfinished role work can see
the full picture without re-deriving it from the code.

## The one thing to understand first: two planes, not one

A role lives on **two independent planes**. They are updated by different
mechanisms and neither one syncs the other automatically:

| Plane | Where it lives | What it controls | Who writes it |
|---|---|---|---|
| **Registration plane** (platform) | Platform DB (`project_business_roles`, app bindings) | Whether the platform *knows* the role exists, shows it in the Roles tab / preview role picker, and can assign it to members | `roles.json` at import/fork, or the agent's `sync_business_roles` tool |
| **Permission plane** (this app) | `src/lib/permissions.ts` `PERMISSION_MATRIX` (+ `role-metadata.ts`) | What the role is *allowed to do* once a request carrying it reaches the app | The agent editing this app's source |

**The classic failure:** a role is visible everywhere in the platform UI
(Roles tab, preview dropdown) but the running app rejects it. That means the
registration plane has the role but the permission plane does not. Fixing one
plane never fixes the other — you must update both. See
[Handoff checklist](#handoff-checklist).

## The three files that must stay in sync

When you add a business role, edit **all three**. A role missing from any one of
them is a half-finished role.

1. **`src/lib/permissions.ts`** — add the role key to `PERMISSION_MATRIX` and
   map it to the `ACTIONS` it may perform. This is the permission plane. A role
   absent here resolves to **zero permissions** via `can()`.
2. **`src/lib/role-metadata.ts`** — add a `ROLE_METADATA` entry (`label`,
   `description`, `defaultRoute`). Drives display name and landing route. An
   unknown role falls back to a generic label + the app home route, so this is
   about polish, not access.
3. **`roles.json`** (repo root) — mirror the role so the platform registers it.
   This is the registration plane's input.

`admin` and `guest` are app-internal fallback roles (used when the gateway has
no role to inject yet). Both stay in `permissions.ts` / `role-metadata.ts` but
**must not** be listed in `roles.json` — neither is a platform business role.

## `roles.json` format

```json
{
  "roles": [
    { "role_key": "youke", "name": "游客", "description": "Read-only guest access" }
  ]
}
```

- `role_key` — **required**. Lowercase snake_case (`^[a-z0-9_]+$`). Must match
  the `PERMISSION_MATRIX` key **exactly** (`operator` ≠ `Operator`). The legacy
  alias `key` is also accepted but prefer `role_key`.
- `name` — **required**. Display name; any language is fine (`游客`, `Guest`).
- `description` — optional.
- The template ships with `roles.json` as `{ "roles": [] }`. Keep it empty until
  the app actually defines business roles; never add demo/test fixtures.

### How the platform consumes it

- **On import / template fork**, the platform reads root `roles.json` and runs
  `SyncAppRoles`: it creates or reuses each `role_key` as a project role and
  binds it to the new app, in one transaction. This is the *only* automatic
  registration step.
- **On export**, the platform *regenerates* `roles.json` from its DB — the file
  you shipped is overwritten with the authoritative registered set. Do not treat
  a hand-edited `roles.json` inside an exported package as durable; it is an
  output of the registration plane, not the source.

## Runtime: how an injected role reaches the app

All traffic arrives through the platform App Gateway. The gateway authenticates
the user, then injects the active business role as a header **it strips and
re-injects on every request** (so the client cannot forge it):

| Runtime | Header carrying the role | Validated upstream by |
|---|---|---|
| Deployed | `X-Tier0-Active-Role` (under `X-Tier0-Runtime: deployed`) | runtime-roles API (user's assigned roles ∩ app bindings) |
| Preview | `X-Tier0-Preview-Role` (under `X-Tier0-Runtime: preview`) | preview role store (developer "view-as" selection) |

`src/lib/gateway.ts` resolves the active role with this precedence:
`X-Tier0-*` runtime headers → legacy `X-App-User-Role` → JSON `user.role`.

### Trust model (why an unregistered-in-matrix role can still enter)

`src/start.ts` treats a role as **authoritative** when it is either:

- present in `PERMISSION_MATRIX`, **or**
- a **gateway-injected Tier0 runtime role** (`getTrustedGatewayRole()` in
  `gateway.ts` — only `X-Tier0-Active-Role` / `X-Tier0-Preview-Role` under an
  explicit `X-Tier0-Runtime`).

A gateway-injected role is trusted **even if it is not yet in
`PERMISSION_MATRIX`**: the gateway already validated it, and it simply resolves
to **zero permissions** via `can()` until the app defines them. This is what
lets a freshly registered platform role (e.g. `youke`) enter the app before the
permission plane has caught up, instead of hard-failing.

Only a role that is **not** gateway-injected and **not** in the matrix — i.e. a
forgeable legacy/login value — fails closed with `403 "Platform role is not
recognized by this app"`. `src/lib/auth.ts` (`getCurrentUser`) mirrors this so
SSR and the middleware agree.

> Security note: the bypass is deliberately scoped to `X-Tier0-*` headers
> because those are stripped and re-injected by the gateway. The legacy
> `X-App-User-Role` path is **not** stripped by the gateway and therefore stays
> gated by `PERMISSION_MATRIX` — do not widen the bypass to cover it.

### Zero permissions is entry, not access

A gateway-injected role with no matrix entry can *load* the app but sees an empty
shell: `canViewModule()` hides every permissioned module and `requireAuth("…")`
server routes still `403` it. Entry ≠ capability. The role only becomes useful
once its actions are defined in `PERMISSION_MATRIX`.

## Handoff checklist

When you add/finish a business role (worked example: guest `youke` / 游客):

- [ ] `permissions.ts`: `youke` added to `PERMISSION_MATRIX` with its exact
      allowed `ACTIONS` (for a read-only guest, the read actions only).
- [ ] `role-metadata.ts`: `ROLE_METADATA.youke = { label: "游客", description, defaultRoute }`.
- [ ] `roles.json`: `{ "role_key": "youke", "name": "游客" }` — key identical to the matrix key.
- [ ] Server routes enforce it via `requireAuth("youke")` where appropriate; UI gates via `can("youke", action)`.
- [ ] Decide and document what a guest may actually see/do — this is a product
      decision the tooling cannot infer.
- [ ] Verify: `npm run typecheck`, `npm run lint`, `npm run runtime:audit`.

### Common pitfalls

- **Editing only `roles.json`** registers the role on the platform but leaves it
  with zero permissions and no metadata in the app. It will appear in the Roles
  tab and preview picker yet do nothing until `permissions.ts` is updated.
- **Editing only `permissions.ts`** gives the app the capability but the platform
  never learns the role exists, so no member can be assigned it and the gateway
  never injects it.
- **Key casing / spelling drift** between the three files silently breaks the
  join — `role_key` must equal the `PERMISSION_MATRIX` key byte-for-byte.
- **Relying on a hand-edited `roles.json` surviving export** — export
  regenerates it from the platform DB.

## Related files

- `src/lib/permissions.ts` — `PERMISSION_MATRIX`, `ACTIONS`, `can()`, `ADMIN_ROLE`
- `src/lib/role-metadata.ts` — `ROLE_METADATA`, `getRoleMetadata()`
- `src/lib/gateway.ts` — `getGatewayRole()`, `getTrustedGatewayRole()`
- `src/start.ts` — request middleware / role authority decision
- `src/lib/auth.ts` — `getCurrentUser()`, `isValidRole()`, `requireAuth()`
- `roles.json` — platform registration input
- [`platform-integration.md`](./platform-integration.md) — full gateway/deploy integration
