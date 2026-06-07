---
name: tier0-sdk-auth-whoami
version: 0.1.0
description: "SDK 调用 auth whoami — 诊断当前 runtime 凭据绑定的用户、Workspace、角色和权限"
---

# auth whoami — runtime 凭据身份诊断

用于排查当前 SDK/runtime 凭据绑定到了哪个用户、Workspace，以及具备哪些角色和权限。

> `auth/whoami` 只用于诊断，不是调用其他 API 的前置步骤。
> 不要为了这个诊断端点生成 API Key 或连接配置页面；401/403 应作为诊断状态展示，除非用户明确要求凭据管理控制台。

## API

```
POST /openapi/v1/auth/whoami
```

## 请求参数

无需业务参数，传空对象即可。

## SDK 调用示例

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.openapiv1authwhoami();
console.log(result);
```

## 响应结构

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

## 排查规则

1. `workspaceID` / `workspaceName` 用来确认当前 key 是否绑定到目标 Workspace。
2. `permissions` 用来确认 key 是否具备目标接口所需权限；`full_access` 可访问所有 OpenAPI 资源。
3. `keyType` 用来区分 personal / service 等 key 类型。
4. 如果接口返回 401，先检查 SDK/runtime 凭据是否可用、`apiHost` 是否可达。
