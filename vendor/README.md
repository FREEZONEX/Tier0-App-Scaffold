# App Stream SDK candidate artifacts

Both archives are immutable local candidates; neither is an npm publication.
Retain them in source/template ZIPs. Their package names and provenance are separate.

| Package | Source commit | Local archive |
|---|---|---|
| `@tier0/sdk@0.5.4` | `6367d22ab481e117c30db9c17a0662b607b9a26f` | `tier0-sdk-0.5.4-6367d22ab481.tgz` |
| `@tier0/sdk-v2@0.7.0` | `d2e5fd0db653939ee8e61bd3565e064486bba342` | `tier0-sdk-v2-0.7.0-d2e5fd0db653.tgz` |

Canonical Stream SDK SHA256: `97d9c5287e172dede629a44528d11505a2ad8fe92e0ddf2675477059957cb077`.
SHA512 SRI: `sha512-K/AUod016QKNXdG1tIsj9z9wdddmAPq2SX8zOWKtaqgwF7+piVmLTgIXahJf0GTF0nsv4PR6dwe3sDcEo8U+tQ==`.

Data/platform SDK SHA256: `a0d97b55029a0f99b14b4f5bb6af6badb7dc8a2772d1820928736e16c46c1f1c`.
SHA512 SRI: `sha512-IBm8Ttd1Gw3jbuoThz0zTgA2DbIHR3M7lnPl8IhFijtmiJ5vcRnYarkPwmODX29nz6/ojgskgAh2U6E8YCKZFA==`.

The canonical SDK supplies `streams.requests/messages` and explicit
`StreamRequestError.outcomeUnknown=false` / unknown-result subclass `true`.
This is a classifier, not a wire execution phase or safe-replay promise:
`retryable=false` and one POST/no automatic retry remain unchanged.
The independent0.7.0 data SDK scopes capability validation by feature and removes
retired public controls methods/types/errors/guidance; it does not add a second
request execution API. The old0.6.2 and ee5499/9538 artifacts remain historical
records, not renamed copies of these final candidates.

The accepted Backend consumer is `5e11f9c46cbfceecf27ae352882bce3663a0cafa`.
The canonical SDK's generated UNS source retains real `c845ba79dad47741985852423215e059d64b948b`
provenance; all accepted input bytes match fresh5e11. Its unchanged V1 projection
retains historical310 provenance with equivalence recorded separately.
Node reuses injected App/internal Key and APP_ID; current policy and persisted
scope ceilings still apply. Installed packages do not migrate old stored Key scopes,
update existing App callers/Pods or prove broker/service/live readiness. Actual
caller inventory, explicit owner-scoped migration, configuration/schema/backup
and live acceptance remain release gates. Do not add Control aliases or browser keys.
