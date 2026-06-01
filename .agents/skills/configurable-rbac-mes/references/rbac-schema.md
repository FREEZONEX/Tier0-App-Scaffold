# RBAC Schema Reference

Use this file only when the user asks for DB-backed or admin-managed RBAC.
For simple apps, keep static role configuration in `src/lib/permissions.ts`.

## Recommended Tables

### `app_roles`

- `id`
- `key` - canonical app role key used by gateway/session logic
- `label` - display name
- `enabled` - boolean
- `description` - optional
- `createdAt`
- `updatedAt`

### `role_actions`

- `id`
- `roleKey`
- `actionKey`
- `createdAt`
- `updatedAt`

Uniqueness: `(roleKey, actionKey)`.

### `role_homepages`

- `id`
- `roleKey`
- `defaultRoute`
- `createdAt`
- `updatedAt`

Uniqueness: `roleKey`.

### `role_nav_modules`

- `id`
- `roleKey`
- `moduleKey`
- `createdAt`
- `updatedAt`

Uniqueness: `(roleKey, moduleKey)`.

### `gateway_role_aliases` Optional

Add only when the platform sends role keys that differ from app role keys.

- `id`
- `gatewayRole`
- `appRoleKey`
- `enabled`
- `createdAt`
- `updatedAt`

Uniqueness: `gatewayRole`.

## Rules

- Keep `ACTIONS` in code as the source of allowed capability keys.
- Use DB rows to configure roles, labels, role-action assignments, role default
  routes, and visible nav modules.
- Do not let arbitrary DB strings create new capability keys without code review.
- Use `bootstrapModule(...)` from services for table/index creation and baseline
  seed. The current scaffold creates all tables/indexes for a module before seed
  callbacks run.
- Seed admin-like recovery access so a bad config does not lock out the app.
