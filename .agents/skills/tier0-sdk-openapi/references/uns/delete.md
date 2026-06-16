---
name: tier0-sdk-openapi-delete
version: 0.2.0
description: "POST /openapi/v1/uns/delete — 删除 UNS 节点（软删除/硬删除）"
---

# delete — `POST /openapi/v1/uns/delete`

> ⚠️ **高风险操作**：硬删除（`hard_delete: true`）不可逆，历史数据一并清除。除非用户明确要求，默认使用软删除（可通过 restore 恢复）。

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsdelete(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topics` | string[] | **是** | 要删除的 topic 路径列表（完整路径，叶子节点或目录均可） |
| `hard_delete` | boolean | 否 | `false`（默认）= 软删除，可通过 restore 恢复；`true` = 硬删除，**不可撤销**，同时清除历史数据 |

## 响应结构

```typescript
{
  code: number;   // 200 = 成功
  msg: string;    // "success"
  data: {};       // 空对象，成功与否依靠外层 code/msg 判断
}
```

## 使用示例

### 软删除（可恢复）

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsdelete({
  topics: ['Plant/Line1/Metric/Temperature'],
  // hard_delete 默认 false，即软删除
});

if (result.code !== 200) {
  console.error('删除失败:', result.msg);
}
```

### 硬删除（不可撤销，需用户明确确认）

```typescript
// ⚠️ 硬删除前必须向用户确认，操作不可逆
const result = await unsApi.openapiv1unsdelete({
  topics: ['Plant/Line1/Metric/OldSensor'],
  hard_delete: true,
});
```

### 批量软删除多个节点

```typescript
const result = await unsApi.openapiv1unsdelete({
  topics: [
    'Plant/Line1/Metric/Sensor1',
    'Plant/Line1/Metric/Sensor2',
  ],
});

// 批量删除：成功与否统一看 code === 200
console.log(result.code === 200 ? '全部删除成功' : `失败: ${result.msg}`);
```
