---
name: tier0-sdk-mq
version: 0.1.0
description: "Tier0 SDK MQ module - MQTT over WebSocket with lazy connection, reconnect, resubscribe, QoS 1 subscriptions, and #/+ wildcard support. triggers: Tier0, SDK, MQ, MQTT, WebSocket, queue, subscribe, publish"
metadata:
  requires:
    npm: ["@tier0/sdk"]
  hermes:
    tags: [sdk, mq, mqtt, websocket, subscribe, publish]
---

# tier0-sdk-mq - Message Queue (MQTT over WebSocket)

## When to Use This Skill

### Use it when

- You need realtime Tier0 UNS subscriptions such as telemetry, status, or alarms
- You need to send commands to devices or systems
- You need to consume Flow-published event streams
- A frontend needs websocket-style push updates

### Do not use it when

- You need history or current snapshots -> use `$tier0-sdk-openapi`
- You need to manage Flow or UNS metadata -> use `$tier0-sdk-openapi`
- The transport is not MQTT over WebSocket -> out of scope for this module

## Non-Negotiable Rules

1. **Host and auth come from env by default.** Do not hardcode `host` or
   passwords unless there is an explicit override use case.
2. **Subscriptions use QoS 1.** Publish defaults to QoS 0 unless explicitly
   overridden.
3. **Handlers receive `(topic, payload)` as strings.** Parse JSON yourself.
4. **Only `#` and `+` wildcards are supported.**
5. **Reconnect and resubscribe are automatic.** Do not duplicate SDK behavior
   with custom reconnect loops.
6. **Do not generate connection settings UI.** MQTT host, port, API key,
   tokens, or workspace bindings belong to the SDK/platform/runtime unless the
   user explicitly asks for a credential console.
7. **Preserve the SSR external policy and lazy-loading boundary.**
   `vite.config.ts` must keep
   `ssr.external: ["pg", "@tier0/sdk", "mqtt"]`. Do not move the SDK or
   `mqtt` into `ssr.noExternal`. Do not top-level import `@tier0/sdk/mq` in
   pages, loaders, or services. Load it through `@/lib/tier0` and await it
   only inside concrete subscribe/publish actions.

## Skill Routing

| Intent | Load | Notes |
|---|---|---|
| Quick start | `references/quickstart.md` | Runtime/env conventions, subscribe, publish, unsubscribe, event hooks |

## Environment Variables

| Variable | Meaning | Notes |
|---|---|---|
| `TIER0_MQTT_HOST` | Platform-injected MQTT broker host | MQTT over WebSocket |
| `TIER0_MQTT_PORT` | Platform-injected MQTT WebSocket port | Defaults to `8084` |
| `TIER0_API_KEY` | Platform-injected credential | Used as the MQTT password |

## Core Concepts

| Concept | Meaning |
|---|---|
| Topic | MQTT path such as `Plant/Line1/Metric/Temperature` |
| Handler | Callback of shape `(topic: string, payload: string) => void` |
| QoS | Subscriptions are fixed at QoS 1; publish defaults to QoS 0 |
| `#` wildcard | Matches multiple levels, for example `home/room/#` |
| `+` wildcard | Matches a single level, for example `home/+/temp` |

## Quick Examples

### Subscribe to realtime data

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

client.subscribe('Plant/Line1/Metric/Temperature', (topic, payload) => {
  const data = JSON.parse(payload);
  console.log(topic, data);
});
```

### Publish a command

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

await client.publish('Device/PLC1/Cmd', {
  action: 'start',
  param: { speed: 100 },
});
```

### Listen to connection events

```typescript
const client = new Tier0MQClient();

client.on('connect', () => console.log('connected'));
client.on('disconnect', () => console.log('disconnected'));
client.on('error', (err) => console.error('error:', err));
```
