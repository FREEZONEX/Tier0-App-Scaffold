# App Stream SDK candidate

`tier0-sdk-0.5.4-ee5499bfdbbc.tgz` packages `@tier0/sdk@0.5.4` from clean Cloud commit
`ee5499bfdbbc10101f1d3dfbae85c85757036d8d`. SHA256:
`9538aca9398ad5a88ab11045787217e5ff20f9bcc4ea186dfb221d33bdec0aca`.
SHA512 SRI: `sha512-C+Wsu8OVuLcLK/iWqReLF9h1DLvLgGM4taKRdmmKqaq4A0xQQjNG4EV8/PfWrNvQmKajebyHo8Puoxz2RwZIIg==`.
The local file dependency and lock integrity identify these bytes; the package
version alone does not identify this candidate. This is a newly built package,
not the historical d43/7f artifacts and not an npm publication.

The independent data/platform package baseline is published `@tier0/sdk-v2@0.6.2`.
Its old controls exports and global `control/v1` discovery requirement still need
an official owner-maintained successor release for the final public naming.
Direct existing Namespace/data calls have no automatic capability-discovery gate;
this does not constitute complete cross-package or live App Stream acceptance.
The separate Stream SDK supplies the sole `streams.requests` execution entry and
the trusted browser message runtime. Do not revive old controls aliases.
Node uses the existing injected App/internal Key and APP_ID, with persisted
unified scopes and current App/entry/topic policy intersection. Installation
does not authorize topics or upgrade old stored Key scopes.

UNS v5 Backend Git schema is pinned at `c845ba79dad47741985852423215e059d64b948b`.
The unchanged v1 projection retains its historical source pin `310bd513fd91efee78a1bf38fcce0b4128e70996`;
the fixed-ref preflight verified equivalence against the final Backend contract.
Legacy Key migration/proof, matched service/App artifacts and live acceptance remain release gates.
Existing Apps require explicit source/package migration; replacing a template
archive does not update or revoke credentials in running Pods. Keep this archive
in source ZIPs and do not replace it with a registry package of the same version.
