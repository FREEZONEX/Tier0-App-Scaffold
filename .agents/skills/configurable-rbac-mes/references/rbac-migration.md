# RBAC Migration Playbook

Use this when upgrading static role checks to a more configurable RBAC model.

## Migration Order

1. **Inventory current behavior**
   - actions
   - roles
   - role labels
   - default routes
   - sidebar/menu visibility
   - API checks
   - page guards

2. **Preserve canonical actions in code**
   - keep `ACTIONS` and `Action` in `src/lib/permissions.ts`
   - avoid renaming actions unless all call sites are updated together

3. **Add configuration storage only when needed**
   - add tables in `src/db/schema.ts`
   - add service-layer runtime bootstrap
   - keep routes thin; routes call services

4. **Seed current behavior first**
   - preserve existing roles and permissions
   - include a safe admin/recovery role
   - do not change visible behavior during this step

5. **Refactor permission helpers**
   - centralize `can(...)` or config-backed equivalent
   - keep unknown roles fail-closed

6. **Refactor menu visibility**
   - use the same permission/module source of truth as API and page guards

7. **Refactor default routes**
   - use one helper or service for role homepage resolution
   - avoid duplicate role switches in multiple files

8. **Add page guards**
   - protect route entry points with `beforeLoad`, loader, or server functions
   - redirect unauthorized users to a safe route

9. **Verify end-to-end**
   - login/gateway session
   - manifest roles
   - default route
   - menu visibility
   - page access
   - API 403 behavior

## Safety Notes

- Keep a safe fallback route for unknown or disabled roles.
- Do not rely on hidden buttons or hidden navigation as enforcement.
- Gateway role names are integration contracts; change them deliberately.
- If adding an alias layer, keep unknown aliases fail-closed.
