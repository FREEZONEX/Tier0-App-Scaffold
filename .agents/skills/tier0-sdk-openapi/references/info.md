---
name: tier0-sdk-openapi-info
version: 0.3.0
description: "POST /openapi/v1/info — 获取 Tier0 服务信息（连通性验证）"
---

# info — `POST /openapi/v1/info`

获取 Tier0 网关服务的基本信息。常用于验证 API 连通性和认证配置是否正确。

## SDK 调用

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();
const result = await systemApi.openapiv1info({});
```

## 请求参数

无参数，传空对象 `{}` 即可。

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: {
    name: string;           // 服务名称，如 "Tier0 UNS OpenAPI"
    version: string;        // API 版本，如 "v1"
    capabilities: string[]; // 支持的操作列表，如 ["read","write","browse","search","create","update","delete"]
    mqttBroker: string;     // MQTT Broker 地址，如 "mqtt.pre.tier0.dev"
  };
}
```

## 使用示例

### 验证连通性与认证

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();
try {
  const result = await systemApi.openapiv1info({});
  console.log('连接成功');
  console.log('  服务:', result.data.name);      // "Tier0 UNS OpenAPI"
  console.log('  版本:', result.data.version);    // "v1"
  console.log('  能力:', result.data.capabilities.join(', '));
  console.log('  MQTT Broker:', result.data.mqttBroker);
} catch (error) {
  if (error instanceof Error) {
    // "HTTP 401" → API Key 无效
    // "HTTP 502" / 网络错误 → Host 配置错误
    console.error('连接失败:', error.message);
  }
}
```
