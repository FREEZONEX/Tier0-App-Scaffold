---
name: tier0-sdk-auth-whoami
version: 0.1.0
description: "SDK auth whoami diagnostic - inspect the user, workspace, role, and permissions bound to the current runtime credential"
---

# auth whoami - runtime credential diagnostic

Use this endpoint to verify which user, workspace, role, and permission set is currently bound to the SDK/runtime credential.

> `auth/whoami` is for diagnostics only. It is not a prerequisite for calling other APIs.
> Do not generate API key or connection settings pages just because this diagnostic exists. Surface 401/403 as diagnostic states unless the user explicitly asks for a credential-management console.

## API

```
POST /openapi/v1/auth/whoami
```

## Request Parameters

No business parameters are required. Send an empty object.

## SDK Call Example

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.openapiv1authwhoami();
console.log(result);
```

## Response Shape

```json
{
  "code": 200,
  "msg": "ok",
  "data": {
    "userID": 1,
    "userName": "agent",
    "email": "agent@example.com",
    "workspaceID": 1001,
    "workspaceName": "Default",
    "apiKeyName": "agent-key",
    "keyPrefix": "sk-per",
    "permissions": ["full_access"],
    "roles": ["admin"],
    "keyType": "personal"
  }
}
```

## Diagnostic Rules

1. Use `workspaceID` / `workspaceName` to confirm the credential is bound to the expected workspace.
2. Use `permissions` to confirm the credential has the required access for the target endpoint. `full_access` covers all OpenAPI resources.
3. Use `keyType` to distinguish personal vs. service credentials.
4. If the call returns 401, check credential availability and `apiHost` reachability before changing application code.
