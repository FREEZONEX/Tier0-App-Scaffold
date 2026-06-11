---
name: tier0-sdk
version: 0.1.1
description: "Tier0 SDK - unified TypeScript/JavaScript SDK covering OpenAPI REST access (with React/Vue3 helpers) and MQ over WebSocket. triggers: Tier0, SDK, OpenAPI, REST, API, MQ, MQTT, WebSocket, React, Vue3, TypeScript"
metadata:
  requires:
    npm: ["@tier0/sdk"]
  hermes:
    tags: [sdk, openapi, rest, api, mq, mqtt, websocket, react, vue3]
---

# tier0-sdk - Tier0 Platform TypeScript SDK

## Overview

`@tier0/sdk` is the official Tier0 Cloud TypeScript/JavaScript SDK. It has two
main submodules:

| Module | Capability | Best fit |
|---|---|---|
| `openapi` | Typed REST API client, React hooks, Vue3 composables | Frontend or Node.js access to Tier0 backend APIs |
| `mq` | MQTT over WebSocket with reconnect and resubscribe behavior | Realtime subscriptions and command publishing |

## Install

```bash
npm install @tier0/sdk
```

Package page: https://www.npmjs.com/package/@tier0/sdk

## Platform-Injected Environment Variables

The SDK reads auth and connection data from the platform/runtime environment.
Applications should not hardcode or persist these values in the scaffold,
generated apps, `.env.example`, the database, or user-facing forms.

| Variable | Meaning | Used by |
|---|---|---|
| `TIER0_API_HOST` | Platform-injected OpenAPI service host | `openapi` |
| `TIER0_API_KEY` | Platform-injected API credential | `openapi`, `mq` |
| `TIER0_MQTT_HOST` | Platform-injected MQTT broker host | `mq` |
| `TIER0_MQTT_PORT` | Platform-injected MQTT WebSocket port, default `8084` | `mq` |

If the platform explicitly requires browser-side env exposure, it should inject
`VITE_TIER0_*` itself. Generated apps must not add those variables to
`.env.example` or turn them into editable settings.

## Rules for Generated Apps

- Do not generate Tier0 SDK config pages, integration settings pages, API key
  forms, token forms, OpenAPI host forms, MQTT host forms, or workspace-binding
  pages.
- Do not treat SDK credentials, hosts, or tokens as business entities, DB
  tables, user settings, `.env.example` placeholders, or editable form fields.
- Only build admin-facing credential management UI when the user explicitly
  requests a platform connection or credential console.
- For ordinary business apps, call the SDK directly. Surface auth failures as
  errors or diagnostics instead of asking users to paste keys into the app.
- When the SDK is used to create UNS nodes/topics, Flow resources, or other
  platform objects, resolve the real app name or stable machine identifier
  first. Do not use the scaffold default package name `scaffold` as a business
  namespace.
- Default app-name resolution order:
  `specs/spec.md` or the user request -> existing app branding (`__root`
  title, login, Shell) -> runtime `APP_ID` or `/api/manifest` `appId`.
  `APP_ID` and `appId` are machine identifiers, not automatically the
  human-readable product name.
- If the only available names are template defaults like `scaffold` or
  `monoapp`, and the platform operation needs a business namespace, inspect the
  actual app branding first or ask the user. Do not create platform resources
  with a template default name.

## TanStack Start SSR Compatibility and Load Boundaries

This scaffold pins the SDK SSR policy in `vite.config.ts`:

```ts
ssr: {
  external: ["pg", "@tier0/sdk", "mqtt"],
}
```

- Keep `pg`, `@tier0/sdk`, and `mqtt` external. `@tier0/sdk@0.1.1` is
  published as CommonJS and must stay out of the Vite/Rolldown SSR ESM bundle.
- Keep `package.json` `postinstall` and `scripts/patch-tier0-sdk.mjs`. Under
  Node 22 the SDK CJS files can be misdetected as ESM because of `import.meta`.
  The patch script adds `type: "commonjs"` and removes CJS-side `import.meta`
  usage after the managed install.
- Do not top-level import `@tier0/sdk/openapi`, `@tier0/sdk/mq`, or wrappers
  that eagerly load the SDK during SSR initialization.
- Use the lazy helpers in `@/lib/tier0`, such as `getTier0UnsApi()`,
  `loadTier0OpenApi()`, or `loadTier0Mq()`. Await them only inside concrete
  actions: user-triggered reads/writes, server route handlers, mutations,
  jobs, dispatch steps, or publish paths.
- If preview or runtime crashes with `ReferenceError: exports is not defined in
  ES module scope` and the stack points into `@tier0/sdk/openapi` or
  `@tier0/sdk/mq`, first confirm the postinstall patch ran, then confirm the
  SDK was not moved into `ssr.noExternal`, and finally check for a top-level
  SDK import. Move that import to a lazy loader call site.
- Do not bypass the SDK with a hand-written MQTT client, fetch wrapper,
  reconnect loop, or custom UNS/Flow endpoint map to avoid SSR issues.
- If another CJS-style dependency is added later, externalize it first and keep
  optional flows lazy-loaded so SSR page entrypoints stay stable.

## Skill Routing

| Intent | Load | Notes |
|---|---|---|
| Use the OpenAPI REST API | `$tier0-sdk-openapi` | Typed REST client, React/Vue3 integration, endpoint references |
| Use MQ | `$tier0-sdk-mq` | Subscribe/publish flows, reconnect behavior, wildcard topics |
| Upgrade the SDK | this file, “Versioning and upgrades” | npm upgrade flow and verification steps |

## Versioning and Upgrades

### Current Version

```bash
npm list @tier0/sdk
```

### Upgrade Commands

```bash
# Show published versions
npm view @tier0/sdk versions --json

# Upgrade to the latest release
npm install @tier0/sdk@latest

# Upgrade to a specific version
npm install @tier0/sdk@0.2.0
```

### Version Snapshot

| Version | Notes |
|---|---|
| `0.1.1` | OpenAPI endpoints, MQ subscribe/publish, React/Vue3 helpers, env-driven auth |
| `0.1.0` | Initial release |

### Post-upgrade Checks

```bash
# Confirm the installed version
npm list @tier0/sdk

# Check TypeScript types
npx tsc --noEmit

# Run tests
npm test
```

### Breaking Change Policy

- Minor releases (`0.x.0`) may include API adjustments. Read the changelog
  before upgrading.
- Patch releases (`0.0.x`) should be safe bug-fix upgrades.
- Breaking changes should document a migration path in the changelog.

## Quick Examples

### OpenAPI: read UNS data

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/Line1/Metric/Temperature'],
});
console.log(result);
```

### MQ: subscribe to realtime data

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

client.subscribe('Plant/Line1/Metric/Temperature', (topic, payload) => {
  console.log(topic, JSON.parse(payload));
});
```
