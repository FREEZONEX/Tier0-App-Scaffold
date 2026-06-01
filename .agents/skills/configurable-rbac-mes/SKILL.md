---
name: configurable-rbac-mes
description: Build, refactor, or upgrade role-based access control in this TanStack Start MES scaffold, including roles, permissions, labels, default routes, menu visibility, page/API guards, and gateway role compatibility. Use when users ask to add roles, change role permissions, make role-specific experiences, create RBAC admin screens, or move static RBAC into DB-backed configuration.
---

# Configurable RBAC for MES

Use this skill for role and permission work in this repository.

This is a scaffold-level skill. Do not copy domain entities, pages, routes, seed
data, or concrete role sets from generated apps. Define roles and permissions
from the current app requirements only.

## Use When

- Adding, removing, renaming, or labeling roles
- Changing what a role can see or do
- Filtering sidebar/navigation by role
- Adding route/page guards
- Adding API permission checks
- Making roles land on different default pages
- Mapping platform gateway roles to app roles
- Building an admin-managed RBAC configuration flow

## Read First

Always inspect the current files before editing:

- `src/lib/permissions.ts`
- `src/lib/auth.ts`
- `src/lib/users.ts`
- `src/lib/gateway.ts`
- `src/start.ts`
- `src/routes/api/manifest.ts`
- `src/routes/_app.tsx`
- `src/routes/_app.index.tsx`
- `src/components/Shell.tsx`
- any route/API/service touched by the requested role change

If building role management UI, also read `DESIGN.md` and use
`$uns-swe-ui-generation` for scaffold-native UI patterns.

If moving RBAC into database configuration, read:

- `references/rbac-schema.md`
- `references/rbac-migration.md`
- `references/rbac-admin-ui.md` if an admin screen is requested

## Architecture Target

Keep RBAC consistent across four surfaces:

1. API access
2. Page access
3. Navigation visibility
4. Default route after login/session creation

A hidden menu item is not access control. Server routes must still enforce
permissions.

### Capability Layer

Keep canonical capability keys in code:

- `ACTIONS`
- `Action`
- `can(role, action)`
- safe fallback helpers

This belongs in `src/lib/permissions.ts`.

### Role Configuration Layer

For simple apps, static `PERMISSION_MATRIX` and optional role metadata in
`permissions.ts` is acceptable.

For configurable RBAC, store these in a service-backed configuration:

- enabled roles
- role labels
- role-to-action assignments
- role default routes
- role-visible nav modules
- optional gateway role aliases

Use service-layer runtime bootstrap for any DB-backed tables. Do not create
schema objects from routes or client components.

### Enforcement Layer

Enforce at runtime in these places:

- API handlers: `requireAuth()` plus action check
- page routes: `beforeLoad`, loader, or server function guard
- navigation: hide or disable modules based on the same action/module policy
- default routing: one helper/source of truth for role homepages

## Implementation Guidance

- Keep `admin` as a safe bootstrap role unless the user explicitly removes it.
- Make gateway role keys match `PERMISSION_MATRIX` keys exactly, or add an
  explicit alias/mapping layer.
- Export `ROLE_LABELS` or equivalent only when labels are actually needed.
- Add helpers like `getDefaultRouteForRole()` only when role-specific landing
  pages exist.
- Add `actions?: Action[]` or equivalent metadata to nav modules only when menu
  filtering is needed.
- Do not introduce role sets copied from generated example apps unless the
  current requirements call for those exact roles.
- Do not import from `@/components/ui` or `@/components/mes` in this clean
  scaffold unless those app-local components have been intentionally created for
  the current app.

## API Pattern

```ts
const user = await requireAuth();
if (!can(user.role, "some_action")) {
  throw new HttpError(403, "Forbidden");
}
```

Keep action names domain-relevant and stable. Avoid broad actions such as
`manage_everything` unless they are only assigned to admin-like roles.

## Migration Order

When refactoring existing static RBAC to configurable RBAC:

1. Inventory current actions, roles, labels, default routes, menus, and API checks.
2. Preserve `ACTIONS` and `Action` as canonical code-level capability keys.
3. Add config tables and a service-layer runtime bootstrap if DB-backed RBAC is needed.
4. Seed the existing behavior first; do not change behavior during the migration.
5. Refactor helpers in `permissions.ts` or a dedicated RBAC service.
6. Refactor Shell/menu visibility.
7. Refactor default route logic.
8. Add missing page guards.
9. Verify each role end-to-end.

See `references/rbac-migration.md` for the detailed checklist.

## Validation

After RBAC work, verify:

- each role can enter through the gateway/login flow
- each role lands on the intended default route
- sidebar/menu visibility matches permissions
- unauthorized pages redirect or render a clear denial state
- restricted APIs return 403
- `/api/manifest` exposes the intended roles and labels
- lint/build pass, or explain why they could not run
