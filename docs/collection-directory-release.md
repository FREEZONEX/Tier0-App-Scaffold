# Collection directory rollout

This change requires a coordinated release of:

- Backend `app-collections/2` with transactional directory reuse/creation.
- A formally distributed SDK that preserves `directoryPath` in `defineCollection`
  and ensure payloads.
- This Scaffold's declaration examples, directory gate and `data:schema` output.
- The Builder Skill instructions and uns-swe MCP/worker guidance.

The Scaffold pins the bundled SDK archive named in `package.json` (see
`vendor/README.md`) and its actual package integrity, following the existing
vendor distribution model. The artifact is included with the source, so
installation never depends on a developer's parent directory or an unpublished
registry version. The archive must carry committed contract provenance for both
`app-collections/2` and `source-lifecycle/2`.
The bundled package has not been published to the registry. Its availability
in this repository does not mean the coordinated backend/worker release has
been deployed.

Old backends reject the new field. New backends reject new aliases without a
path. Prepare the complete artifacts and coordinate the worker/template/backend
cutover in one release window; do not add a default root App-folder fallback.
Existing aliases may still omit paths, and ensure never relocates them.
App or business-module directories remain valid under a known business scope,
for example Factory → Line → MES → Work orders.

Runtime acceptance must verify several collections in real business scopes,
reuse of an existing directory, shared data at a common ancestor, missing-path
failure for a new alias, and preservation of an existing alias's location.
Local tests do not establish that any environment has been deployed.

Companion PRs targeting `feature/cloud-new-architecture-migration`:

- [Backend #1223](https://github.com/FREEZONEX/Tier0-Backend/pull/1223)
- [SDK #50](https://github.com/FREEZONEX/Tier0-sdk-v2/pull/50)
- [Builder Skill #32](https://github.com/FREEZONEX/Tier0-Builder-Skill/pull/32)
- [uns-swe #817](https://github.com/FREEZONEX/uns-swe/pull/817)
