# RBAC Admin UI Guidance

Use this only when the user asks for a role/permission management screen.

## Placement

Build under a workspace route such as `/_app/roles` or another appropriate
authenticated admin route. Add a Shell module only if the app has workspace
navigation and the current role can manage RBAC.

## Minimum Views

### Role List

Show:

- role label
- role key
- enabled status
- default homepage
- visible module count
- action count

### Role Detail / Editor

Allow editing:

- label
- enabled status
- default homepage
- visible modules
- permission checklist or matrix
- gateway aliases if enabled

## UI Rules

- Read and follow `DESIGN.md`.
- Use `$uns-swe-ui-generation` for scaffold-native Tailwind/Tier0 patterns.
- Do not assume `src/components/ui` or `src/components/mes` exists in the clean
  scaffold. Create small app-local components only if the current app needs them.
- Prefer table plus detail panel, split view, drawer, or modal depending on the
  amount of editing.
- Use `toast.success()` and `toast.error()` for saves.
- Provide loading, empty, validation error, API error, and disabled/pending states.
- No placeholder copy or disconnected controls.

## Validation

After changing a role in UI, verify that the change affects:

- sidebar/menu visibility
- default homepage
- page access
- API access
- `/api/manifest` output when roles or labels changed
