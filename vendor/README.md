# Cloud App SDK archive

The scaffold consumes the local employee-only package
`@tier0/sdk-v2@0.10.1-aenv.13` from
`file:vendor/tier0-sdk-v2-0.10.1-aenv.13.tgz`. It is not published to npm.
The lockfile records the actual archive's SHA512. The installed ESM/CJS
entry points, strict employee visitor parser and outbound App Key transport
are exercised by `tests/sdk-contract.test.ts`.

## Latest base retained

The base scaffold used the unmodified npm release `@tier0/sdk-v2@0.10.1`
from `https://registry.npmjs.org/@tier0/sdk-v2/-/sdk-v2-0.10.1.tgz`,
SHA256 `667e700c16f679b8284627a53fddc01a4092a277bca3652d91788c10ab5ab945`.
The local package retains its committed Backend contract
`07ef8cd30a5465a98c8e6ee0892d02360aee8761`, unified Builder grant guidance,
platform, data and Stream APIs. Generated contracts are inherited unchanged,
not hand-edited or re-synchronized during this cutover.

The bundled entry is `skills/tier0-sdk-v2/SKILL.md`, with 11 nested domain
Skills. Read the installed package's guidance, not a global older SDK Skill.
Historical archives, including the homelab-tested `0.10.0-aenv.12`, are retained
for provenance and are not installed. That older report does not prove the
rebased package was deployed or tested in a live environment.

## Local integration

After the SDK edits are complete, build its ESM/CJS outputs and run
`npm pack --ignore-scripts --pack-destination ../Tier0-App-Scaffold/vendor`.
This local-only packaging avoids the unrelated release suite; it is never
`npm publish`. Install the exact artifact from this scaffold with
`npm install --ignore-scripts --save-exact ./vendor/tier0-sdk-v2-0.10.1-aenv.13.tgz`.
Compare the built output, archive and installed files, and verify the lock
SHA512 against the actual archive. Run the visitor/App Key contract tests and
typecheck before delivery.

Commit content first, then run `node scripts/scaffold-version.mjs --bump`
on the clean tree and commit the stamp separately so the marker names the
actual content commit. Do not invent a marker ref or squash away that commit.

Updating the template does not update existing Apps or establish live Backend
compatibility. Retiring machine entry points and stripping untrusted identity
headers at the front door makes old call tokens unusable; a bypass ingress is
not secured by updating this parser alone. Employee grants and platform App
Keys remain separate and supported.
