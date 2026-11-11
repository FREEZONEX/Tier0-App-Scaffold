# Historical SDK archives

The scaffold installs `@tier0/sdk-v2` from npm at the exact version in
`package.json`; `package-lock.json` records its registry URL and integrity,
and `tests/app-streams.test.ts` / `tests/sdk-contract.test.ts` check both.
Nothing in this directory is installed.

The archives here are kept for provenance and for the older-scaffold
migrations in `docs/platform-integration.md`. Do not add new ones: an SDK
change ships as an npm release first, then the scaffold pins that version.

## Updating the SDK

Set the exact version in `package.json`, run `npm install`, and check that the
lockfile entry resolves to `https://registry.npmjs.org/@tier0/sdk-v2/-/sdk-v2-<version>.tgz`
with the integrity `npm view @tier0/sdk-v2@<version> dist.integrity` reports.
Run the full checks, commit the content, then run
`node scripts/scaffold-version.mjs --bump` on the clean tree and commit the
stamp separately.

Updating the template does not update existing Apps or establish live Backend
compatibility.
