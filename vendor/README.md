# App Stream SDK candidate

`tier0-sdk-0.5.4-d43d12b.tgz` packages `@tier0/sdk` from Cloud commit
`d43d12b889c7f1f8c5ee23a0d34230cb04361926`. SHA256: `471a1cb110d792137a5d14b60546da034493dd7f5385438e3509dae0daa6f01b`.
The local file dependency and lock integrity identify these bytes; the package
version alone does not identify this candidate. This is a newly built package,
not the historical 7f artifact and not an npm publication.

The current template keeps `@tier0/sdk-v2` exactly `0.6.1` for data/platform
integration and its current UNS v5 single model. The Stream SDK supplies the
sole `streams.requests` execution entry and the trusted browser message runtime.
Node uses the existing injected App/internal Key and APP_ID, with persisted
unified scopes and current App/entry/topic policy intersection. Installation
does not authorize topics or upgrade old stored Key scopes.

Backend Git schema is pinned at `310bd513fd91efee78a1bf38fcce0b4128e70996`.
Legacy Key migration/proof, matched service/App artifacts and live acceptance remain release gates.
Existing Apps require explicit source/package migration; replacing a template
archive does not update or revoke credentials in running Pods. Keep this archive
in source ZIPs and do not replace it with a registry package of the same version.
