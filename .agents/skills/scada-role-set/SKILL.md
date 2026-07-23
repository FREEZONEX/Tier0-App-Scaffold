---
name: scada-role-set
description: This SCADA/HMI product's fixed 3-role set (admin/operator/guest) and the HMI view tier each maps to. Use before adding, removing, renaming, or changing what any role can do — including via $configurable-rbac-mes — to make sure these three roles and their behavior stay intact.
---

# SCADA Role Set — admin / operator / guest

This product has exactly three roles. They map 1:1 to the three HMI view
tiers in `src/hmi/components/HmiPage.tsx` (`canEdit` / `forceDemo`) and
`src/routes/_app.index.tsx` (where those flags are computed from the role):

| Role | `PERMISSION_MATRIX` | View | Notes |
|---|---|---|---|
| `admin` | `[...ACTIONS]` (full) | Edit + Preview, switchable | `canEdit = can(role, "edit_mimic")` → true |
| `operator` | `["view_dashboard"]` | Preview only, real mimic, read-only | `canEdit` false, `forceDemo` false (has `view_dashboard`) |
| `guest` | not a matrix key (`GUEST_ROLE` in `src/lib/permissions.ts`) | Demo only, built-in mimic, read-only | `can()` resolves any unrecognized role to zero permissions; `forceDemo = !can(role, "view_dashboard")` → true |

Mode is decided by role alone — it does **not** depend on whether the
database has real mimic data (see `src/hmi/components/HmiPage.tsx`'s `mode`
initial state). An empty database only affects whether admin's mode switcher
additionally shows a "Demo" tab (`demoAvailable`); it never changes what
operator or guest can reach.

`guest` is minted automatically (`src/routes/login.tsx`'s hidden auth
bridge, `src/start.ts`'s middleware) whenever the gateway has no role to
inject for a request — it must never fall back to `admin`.

## When to apply this

Before any role change in this project — adding a role, removing one,
renaming one, changing an action set, or anything routed through
`$configurable-rbac-mes` — keep these three roles and this exact
admin/operator/guest → Edit+Preview/Preview/Demo mapping. If a requirement
genuinely calls for a fourth role or a different mapping, that's a deliberate
product decision to confirm with the user first, not a default outcome of
generic RBAC refactoring.

## Where they're registered

All three are listed in `roles.json` (including `admin` and `guest`, unlike
the general "keep app-internal roles out of roles.json" convention in
`docs/role-registration.md`) — this project keeps them there on purpose so a
tester can assign any of the three from the platform's role picker and
verify each view live.
