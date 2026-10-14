# Role Registration

The platform registers roles and assigns them to users. The App defines what
those roles may do. Updating one side does not automatically update the other.

When adding, renaming or removing a role, update all three:

| File | Responsibility |
|---|---|
| `src/lib/permissions.ts` | `ACTIONS`, `PERMISSION_MATRIX` and action authorization |
| `src/lib/role-metadata.ts` | Labels, descriptions and landing routes |
| Root `roles.json` | Platform registration input |

There are no reserved or default roles, including `admin`. Start with a small
set of materially different permission scopes; do not create a role per page.
Every defined role must appear in all three files with the same key.

## `roles.json` format

```json
{
  "roles": [
    { "role_key": "youke", "name": "游客", "description": "Read-only guest access" }
  ]
}
```

- `role_key` — **required**. Lowercase snake_case letters only:
  `^[a-z]+(_[a-z]+)*$` — the platform rejects digits, hyphens, uppercase, and
  leading/trailing/double underscores (`hello_world` OK; `role2`, `AItest_x`
  rejected). Must match the `PERMISSION_MATRIX` key **exactly**
  (`operator` ≠ `Operator`). Use `role_key` in new files.
- `name` — **required**. Display name; any language is fine (`游客`, `Guest`).
- `description` — optional.
- The template ships with `roles.json` as `{ "roles": [] }`. Keep it empty until
  the app actually defines business roles; never add demo/test fixtures.

### Platform registration

Import/fork reads root `roles.json`. During Builder work, use its
`sync_business_roles` capability when available to register updates. Verify the
role is available for assignment; editing the matrix alone is insufficient.
Platform export can regenerate `roles.json` from its registered set, so sync
registration before relying on an exported package.

## Runtime: how assigned roles reach the app

All traffic arrives through the platform App Gateway. The gateway authenticates
the user, then injects role headers that it **strips and re-injects on every
request** (so the client cannot forge them):

| Runtime | Headers carrying roles | Effective model | Validated upstream by |
|---|---|---|---|
| Deployed | `X-Tier0-Business-Roles` plus `X-Tier0-Active-Role` | Union of all assigned app roles; active role is primary display only | Platform Gateway |
| Preview | `X-Tier0-Preview-Role` | One developer-selected "view-as" role | preview role store |

`X-Tier0-Business-Roles` is comma-separated. `src/lib/gateway.ts` normalizes
and deduplicates it, keeps the active role first, and exposes the complete set
on `AppUser.roles` for the current request. Legacy `X-App-User-Role` /
JSON `user.role` integrations remain single-role.

### Multiple roles use permission union

Do not invent role priority or choose one "highest" role. For a user assigned
roles A and B, the effective action set is `permissions(A) ∪ permissions(B)`.
Use `can(user.roles, action)` for action checks and navigation.
`requireAuth(...roles)` optionally checks membership in any supplied role; it
does not check an action permission. Apply action checks on server routes/services,
not just in UI. Unknown trusted Tier0 roles contribute no
actions; they never erase permissions granted by another known assigned role.
`user.primaryRole` exists only for display metadata; never authorize with it.

### Trust model (why an unregistered-in-matrix role can still enter)

`src/start.ts` treats a role as **authoritative** when it is either:

- present in `PERMISSION_MATRIX`, **or**
- a **gateway-injected Tier0 runtime role set** (`getTrustedGatewayRoles()` in
  `gateway.ts` — deployed `X-Tier0-Business-Roles` / active role, or preview
  `X-Tier0-Preview-Role`, under an explicit `X-Tier0-Runtime`).

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
shell: `canViewModule()` hides permissioned modules and server action checks
using `can()` deny access. Authentication alone does not grant a business action.
The role only becomes useful
once its actions are defined in `PERMISSION_MATRIX`.

## Verification

- Register the role and synchronize all three files.
- Authenticate with `requireAuth()` and enforce the appropriate action with
  `can(user.roles, action)`; add per-record ownership rules where needed.
- Verify one role, multiple roles, empty roles and unknown trusted roles through
  real server routes as well as navigation. A hidden button is not authorization.
- Run typecheck, lint and runtime audit when role implementation changes.

## Related files

- `src/lib/permissions.ts` — `PERMISSION_MATRIX`, `ACTIONS`, `can()`
- `src/lib/role-metadata.ts` — `ROLE_METADATA`, `getRoleMetadata()`
- `src/lib/gateway.ts` — `getGatewayRole()`, `getGatewayRoles()`, `getTrustedGatewayRoles()`
- `src/start.ts` — request middleware / role authority decision
- `src/lib/auth.ts` — `getCurrentUser()`, `isValidRole()`, `requireAuth()`
- `roles.json` — platform registration input
- [`platform-integration.md`](./platform-integration.md) — full gateway/deploy integration
