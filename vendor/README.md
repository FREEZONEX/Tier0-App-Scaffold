# Frozen App Stream SDK

`tier0-sdk-0.5.4-7f0a82e.tgz` is the immutable `@tier0/sdk` artifact from
`FREEZONEX/Tier0-sdk` commit `7f0a82ef6a719dd6843c29c1046f87ad3c2970a7`.
It is not an npm publication. The source artifact manifest is
`artifact-manifest.json` from the coordinated SDK distribution.

SHA256: `63ca9a348124acaab14c2fa9319b1aed10ff22bc3419ef81daa2b95f1e77afb5`.
The local `file:` dependency and package-lock SHA512 pin these exact bytes;
`test:streams` verifies both and exercises the installed browser entry point.
Keep this archive in uploaded source ZIPs. Do not replace it with the registry's
package of the same version.

The existing `@tier0/sdk-v2` data dependency and its commit remain unchanged.
The Stream SDK does not replace `@tier0/sdk-v2/data` or its server-side App Key.
Installing this package does not provision a broker, authorize topics, migrate
existing Apps or prove browser deployment acceptance.
