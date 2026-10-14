# Tier0 App Scaffold

TanStack Start 1.x, React 19, Zod and TailwindCSS 4 for Tier0 business Apps.
Reuse the Gateway identity, roles, routing and UI components. New business data
uses Enterprise OpenAPI v2 through the App server.

**Migration status:** API-only development rules are defined; the template still
contains SQL runtime dependencies and gates. See the
[migration checklist](docs/scaffold-api-migration.md) before treating it as a
ready-to-deploy API starter.

## Read by Task

| Task | Source of truth |
|---|---|
| Generate or change an App | [AGENTS.md](AGENTS.md) |
| Data model, provisioning, transactions, queries | [App API development](docs/app-api-development.md) |
| CRM-derived acceptance cases | [CRM lessons](docs/crm-api-lessons.md) |
| Runtime configuration, Gateway and SDK | [Platform integration](docs/platform-integration.md) |
| Register and authorize business roles | [Role registration](docs/role-registration.md) |
| Visual tokens, density, icon style | [DESIGN.md](DESIGN.md) |
| Forms, tables, adapters and editors | [Component kit](docs/component-kit.md) |
| Inspect real component examples | [Component gallery](gallery/README.md) |
| Complete API template migration | [Migration checklist](docs/scaffold-api-migration.md) |

## Development and Verification

In managed Builder preview, use `preview_start`, `preview_logs` and
`preview_restart`; it owns dependency installation and server startup.
In an unmanaged checkout, `npm install` and `npm run dev` start the existing
template shell. Neither path provisions App data or completes the API migration.

| Command | Purpose |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Build plus required postbuild gates |
| `npm run smoke:routes -- <local-url>` | Check sidebar routes against a running App |
| `npm run gallery:build` | Build the independent component gallery |
| `npm start` | Production Node entry |

Production output is `dist/client/` and `dist/server/server.js`; `server.mjs`
serves them on `PORT` (default 3000). `artifact.toml` owns build/run arguments.
The remaining DB scripts are migration work, not the new App development flow.
For documentation-only changes, check links, examples, whitespace and the version
marker instead of building or touching a business database.

## Scaffold Version (Maintainers)

`package.json.tier0Scaffold` is the scaffold's version marker:

```json
{ "tier0Scaffold": { "version": 14, "ref": "e4f1c2a" } }
```

`version` is a positive integer that the platform compares by strict equality
with the App's marker on import (missing or different → the Builder offers to
align the App). `ref` is the short sha of the scaffold commit the version was
stamped on; it is informational and lets the align Skill locate the source.
`src/lib/scaffold-version-contracts.test.mjs` (locked) validates the field's
format when it is present, and `scripts/scaffold-version.mjs` warns in
`postbuild`; neither fails an App build that lost the field. Presence is
required only in this repository's CI, through
`node scripts/scaffold-version.mjs --strict`.

**When to bump.** Every PR that changes what generated Apps inherit — the
rules in `AGENTS.md` / `README.md`, `src/lib/**`, `src/services/bootstrap.ts`,
`scripts/**`, `artifact.toml`, `vite.config.ts`, `server.mjs`, `package.json`
dependencies or scripts, `.env.example` — bumps the version by one. Do not
judge the size of the change. Pure wording, placeholder covers, or internal
test adjustments do not bump. The `Scaffold version check` workflow fails a PR
that touches those paths without a bump.

**How to bump.** Commit the content first, then stamp on a clean tree as its
own commit so `ref` names the content commit:

```bash
git commit -am "feat(...): ..."          # the content commit
node scripts/scaffold-version.mjs --bump  # version + 1, ref = short sha of HEAD
git commit -am "chore(scaffold): stamp v<version>"
```

`--bump` exits 1 when anything other than `package.json` is uncommitted.
`node scripts/scaffold-version.mjs` validates the field (warn-only);
`--strict` makes problems fatal and is what CI runs.

**Never squash-merge** scaffold PRs: `ref` would point at a commit that does
not exist on `main`. After a merge that changed the version, the
`Scaffold version tag` workflow tags the merge commit `scaffold/v<version>`,
so a version can be traced back to its commit from the tag.
