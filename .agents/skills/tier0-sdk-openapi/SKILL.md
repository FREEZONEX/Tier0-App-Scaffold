---
name: tier0-sdk-openapi
version: 0.1.0
description: "Tier0 SDK OpenAPI module - typed REST API client with base HTTP access, React hooks (@tanstack/react-query), and Vue3 composables. Covers UNS, Flow, and system endpoints. triggers: Tier0, SDK, OpenAPI, REST, API, UNS, Flow, React, Vue3"
metadata:
  requires:
    npm: ["@tier0/sdk"]
  hermes:
    tags: [sdk, openapi, rest, api, react, vue3, uns, flow]
---

# tier0-sdk-openapi - REST API Wrapper

## When to Use This Skill

### Use it when

- A frontend or Node.js project needs to call Tier0 backend APIs
- The implementation needs type-safe request and response usage
- A React project wants mutation/query patterns
- A Vue3 project wants composable-style integration

### Do not use it when

- The task is realtime subscriptions -> use `$tier0-sdk-mq`
- The task is MQTT publishing -> use `$tier0-sdk-mq`
- The task is direct database or protocol access -> outside SDK scope

## Non-Negotiable Rules

1. **SDK auth and connection details belong to the platform/runtime/SDK.**
   Do not generate API key, token, OpenAPI host, workspace-binding, or generic
   connection settings pages in normal business apps.
2. **Response types come from the generated SDK types.**
   Do not handcraft response interfaces when `components["schemas"]["..."]` or
   the exported SDK types already exist.
3. **Do not import the SDK React hooks directly into this scaffold’s client
   layer by default.** The current SDK ships as CommonJS, and
   `@tier0/sdk/openapi/react` is not the default data path for generated apps.
   Prefer app-local React hooks that call this app’s own server routes, and let
   those server routes load the SDK through `@/lib/tier0`.
4. **Vue3 composables do not apply to this scaffold by default.** This
   template is not a Vue project. Do not import `@tier0/sdk/openapi/vue`
   unless the user explicitly wants a Vue build and the SDK packaging format is
   confirmed to work there.
5. **Do not hand-roll auth UI.** Surface 401/403 as diagnostic or business
   errors unless the user explicitly asks for a credential console.
6. **Preserve the SSR external policy and lazy-loading boundary.**
   `vite.config.ts` must keep
   `ssr.external: ["pg", "@tier0/sdk", "mqtt"]`. Do not move the SDK into
   `ssr.noExternal`. Do not top-level import `@tier0/sdk/openapi` in pages,
   loaders, or services. Load through `@/lib/tier0` helpers and await the SDK
   only inside concrete read/write/publish actions.
7. **For mutating endpoints, verify the real request shape first.**
   Do not infer request bodies from endpoint names. Read the matching reference
   and trust the SDK type declarations. In particular,
   `unsApi.openapiv1unscreate(...)` must receive `NodeCreateReq`, meaning
   `{ namespace: NamespaceNode[] }`, not a guessed `{ path, topic, valueType }`
   shape.
8. **For UNS create, confirm naming vocabulary before the first call.**
   The SDK requires `name` and `type` but does not narrow `type` or
   `topicType` to a fixed enum. If the user or codebase has not already
   established those values, inspect existing nodes with `browse` / `search`
   and reuse the same vocabulary before attempting a create call.

## Skill Routing

### General guides

| Intent | Load | Notes |
|---|---|---|
| Basic usage | `references/quickstart.md` | Runtime/env conventions, base calls, diagnostics |
| React hooks | `references/react.md` | Mutation-style usage and QueryClient setup |
| Vue3 composables | `references/vue.md` | Reference only; not the default path for this scaffold |

### System endpoints

| Endpoint | Load | Notes |
|---|---|---|
| `GET /gw/reload` | `references/reload.md` | Gateway reload |
| `POST /openapi/v1/info` | `references/info.md` | Service information |
| `POST /openapi/v1/auth/whoami` | `references/auth/whoami.md` | Runtime API-key identity/permission diagnostics |

### Flow endpoints

| Endpoint | Load | Notes |
|---|---|---|
| `POST /openapi/v1/flow/create` | `references/flow/create.md` | Create Flow |
| `POST /openapi/v1/flow/delete` | `references/flow/delete.md` | Delete Flow |
| `POST /openapi/v1/flow/deploy` | `references/flow/deploy.md` | Deploy Flow |
| `POST /openapi/v1/flow/flowdata` | `references/flow/flowdata.md` | Fetch canvas data |
| `POST /openapi/v1/flow/get` | `references/flow/get.md` | Get Flow details |
| `POST /openapi/v1/flow/list` | `references/flow/list.md` | List Flows |
| `POST /openapi/v1/flow/nodes` | `references/flow/nodes.md` | Query available node types |
| `POST /openapi/v1/flow/update` | `references/flow/update.md` | Update Flow |

### UNS endpoints

| Endpoint | Load | Notes |
|---|---|---|
| `POST /openapi/v1/uns/browse` | `references/uns/browse.md` | Browse namespace |
| `POST /openapi/v1/uns/create` | `references/uns/create.md` | Create nodes |
| `POST /openapi/v1/uns/delete` | `references/uns/delete.md` | Delete nodes |
| `POST /openapi/v1/uns/history` | `references/uns/history.md` | Query history |
| `POST /openapi/v1/uns/read` | `references/uns/read.md` | Read points |
| `POST /openapi/v1/uns/restore` | `references/uns/restore.md` | Restore nodes |
| `POST /openapi/v1/uns/search` | `references/uns/search.md` | Search nodes |
| `POST /openapi/v1/uns/update` | `references/uns/update.md` | Update nodes |
| `POST /openapi/v1/uns/write` | `references/uns/write.md` | Write points |

## API Module Cheatsheet

```typescript
import {
  getTier0FlowApi,
  getTier0SystemApi,
  getTier0UnsApi,
} from '@/lib/tier0';

const systemApi = await getTier0SystemApi();
const flowApi = await getTier0FlowApi();
const unsApi = await getTier0UnsApi();
```

| Module | Method | Notes |
|---|---|---|
| `systemApi` | `gwreload()` | Reload gateway |
| `systemApi` | `openapiv1authwhoami(body?)` | Runtime identity/permission diagnostic |
| `systemApi` | `openapiv1info(body)` | Service information |
| `flowApi` | `openapiv1flowcreate(body)` | Create Flow |
| `flowApi` | `openapiv1flowdelete(body)` | Delete Flow |
| `flowApi` | `openapiv1flowdeploy(body)` | Deploy Flow |
| `flowApi` | `openapiv1flowflowdata(body)` | Fetch canvas data |
| `flowApi` | `openapiv1flowget(body)` | Get Flow details |
| `flowApi` | `openapiv1flowlist(body)` | List Flows |
| `flowApi` | `openapiv1flownodes(body)` | Query available nodes |
| `flowApi` | `openapiv1flowupdate(body)` | Update Flow |
| `unsApi` | `openapiv1unsbrowse(body)` | Browse namespace |
| `unsApi` | `openapiv1unscreate(body)` | Create nodes |
| `unsApi` | `openapiv1unsdelete(body)` | Delete nodes |
| `unsApi` | `openapiv1unshistory(body)` | Query history |
| `unsApi` | `openapiv1unsread(body)` | Read points |
| `unsApi` | `openapiv1unsrestore(body)` | Restore nodes |
| `unsApi` | `openapiv1unssearch(body)` | Search nodes |
| `unsApi` | `openapiv1unsupdate(body)` | Update nodes |
| `unsApi` | `openapiv1unswrite(body)` | Write points |
