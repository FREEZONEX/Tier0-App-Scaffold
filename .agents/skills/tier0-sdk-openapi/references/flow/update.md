---
name: tier0-sdk-openapi-flow-update
version: 0.2.0
description: "POST /openapi/v1/flow/update — 更新 Flow 元数据（名称/描述/收藏）"
---

# update — `POST /openapi/v1/flow/update`

更新 Flow 的元数据（名称、描述、收藏状态）。**不用于修改 Node-RED 画布内容**（那是 deploy 的职责）。

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowupdate(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | integer | **是** | Flow 的 DB 主键 |
| `flowName` | string | 否 | 新名称（同类型下唯一） |
| `description` | string | 否 | 新描述 |
| `isFavorite` | integer | 否 | 收藏状态：`1` = 收藏，`2` = 取消收藏（注意是整数，不是 boolean） |
| `template` | string | 否 | 模板标识 |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: { success: boolean };
}
```

## 使用示例

### 重命名 Flow

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
await flowApi.openapiv1flowupdate({
  id: 42,
  flowName: 'modbus-line1-v2',
});
```

### 收藏 / 取消收藏

```typescript
// 收藏
await flowApi.openapiv1flowupdate({ id: 42, isFavorite: 1 });

// 取消收藏
await flowApi.openapiv1flowupdate({ id: 42, isFavorite: 2 });
```

### 更新描述

```typescript
await flowApi.openapiv1flowupdate({
  id: 42,
  description: '已接入产线1全部 Modbus 点位，采集周期 500ms',
});
```
