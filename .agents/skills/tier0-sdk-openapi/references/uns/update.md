---
name: tier0-sdk-openapi-update
version: 0.2.0
description: "POST /openapi/v1/uns/update — 更新 UNS 节点元数据（字段定义/描述/名称）"
---

# update — `POST /openapi/v1/uns/update`

更新节点的元数据（字段定义、描述、显示名称等）。**不用于写入 VQT 数据**（那是 write 的职责）。

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsupdate(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | string | **是** | 目标节点完整路径 |
| `fields` | FieldDef[] | 否 | 新的字段定义（仅 METRIC 节点有效） |
| `description` | string | 否 | 新描述 |
| `displayName` | string | 否 | 新显示名称 |
| `alias` | string | 否 | 别名 |
| `updateMask` | string[] | 否 | 指定要更新的字段名列表。**不传则更新所有非空字段**；传入如 `["description"]` 则只更新该字段，其余保持不变 |
| `extendProperties` | object | 否 | 自定义扩展属性（key-value 对） |

### FieldDef 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 字段名，不能是 `_timestamp`（系统保留） |
| `type` | string | `int` / `float` / `string` / `bool` |
| `unit` | string | 单位（可选） |

## 响应结构

```typescript
{
  code: number;   // 200 = 成功
  msg: string;    // "success"
  data: {};       // 空对象，成功与否依靠外层 code/msg 判断
}
```

## 使用示例

### 只更新描述（用 updateMask 精确控制）

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
await unsApi.openapiv1unsupdate({
  path: 'Plant/Line1/Metric/Temperature',
  description: '产线1温度传感器，量程 -20~80°C',
  updateMask: ['description'],  // 只更新 description，不动 fields
});
```

### 更新字段定义（新增 unit 字段）

```typescript
await unsApi.openapiv1unsupdate({
  path: 'Plant/Line1/Metric/Temperature',
  fields: [
    { name: 'temperature', type: 'float', unit: '°C' },
    { name: 'unit', type: 'string' },
    { name: 'status', type: 'string' },  // 新增字段
  ],
  updateMask: ['fields'],
});
```

### 同时更新多个属性

```typescript
await unsApi.openapiv1unsupdate({
  path: 'Plant/Line1/Metric/Temperature',
  displayName: '产线1温度（修正）',
  description: '已校准的温度传感器数据',
  // 不传 updateMask → 更新所有非空字段
});
```
