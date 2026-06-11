---
name: tier0-sdk-mq-quickstart
version: 0.1.0
description: "MQ quick start: runtime config contract, subscribe, publish, unsubscribe, and event hooks"
---

# MQ Quick Start

## Runtime Configuration Contract

The SDK reads MQTT auth and connection values from the platform/runtime
environment. Generated apps should not hardcode them into the scaffold,
`.env.example`, the database, or user-facing settings.

When generating an app:

- Do not create MQTT host, port, API key, token, workspace-binding, or generic
  connection settings pages.
- Do not persist SDK credentials in the application database.
- Do not place SDK auth values in `.env.example` or user settings.
- Do not ask regular users to paste keys into business UIs.
- Only build a credential console when the user explicitly requests it.

| Variable | Meaning | Notes |
|---|---|---|
| `TIER0_MQTT_HOST` | Platform-injected | MQTT broker host |
| `TIER0_MQTT_PORT` | Platform-injected | MQTT WebSocket port, default `8084` |
| `TIER0_API_KEY` | Platform-injected | Auth credential used as the MQTT password |

In ordinary business apps, instantiate `new Tier0MQClient()` directly and let
SDK/platform/runtime provide auth and connection details. Explicit connection
parameters are only for off-platform test scripts or an explicitly requested
admin credential console.

In this TanStack Start scaffold, MQ SDK loading must stay lazy. Do not top-level
import `@tier0/sdk/mq` in pages, loaders, or services. Load it through
`@/lib/tier0` and await it only inside concrete subscribe or publish actions.

## Subscribe

### Basic subscription

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

client.subscribe('Plant/Line1/Metric/Temperature', (topic, payload) => {
  console.log(topic, payload);
});
```

### Wildcard subscription

```typescript
// # matches multiple levels
client.subscribe('Plant/Line1/#', (topic, payload) => {
  // Matches Plant/Line1/Metric/Temperature
  // Matches Plant/Line1/State/MachineStatus
});

// + matches one level
client.subscribe('Plant/+/Metric/Temperature', (topic, payload) => {
  // Matches Plant/Line1/Metric/Temperature
  // Matches Plant/Line2/Metric/Temperature
  // Does not match Plant/Line1/Living/Metric/Temperature
});
```

### Multiple handlers for the same topic

```typescript
const handler1 = (topic: string, payload: string) => {
  console.log('handler1:', payload);
};

const handler2 = (topic: string, payload: string) => {
  console.log('handler2:', JSON.parse(payload));
};

client.subscribe('sensor/temp', handler1);
client.subscribe('sensor/temp', handler2);
```

## Publish

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

await client.publish('Device/Cmd', 'START');

await client.publish('Device/Cmd', {
  action: 'setSpeed',
  params: { speed: 120 },
});

await client.publish('Device/Status', 'online', { qos: 2, retain: true });
```

## Unsubscribe

```typescript
client.unsubscribe('sensor/temp', handler1);
client.unsubscribe('sensor/temp');
```

## Event Hooks

```typescript
const client = new Tier0MQClient();

client.on('connect', () => {
  console.log('MQ connected');
});

client.on('disconnect', () => {
  console.log('MQ disconnected');
});

client.on('error', (err) => {
  console.error('MQ error:', err);
});
```

## Disconnect

```typescript
client.disconnect();
```

## Status Checks

```typescript
console.log(client.isConnected);
console.log(client.subscribedTopics);
```
