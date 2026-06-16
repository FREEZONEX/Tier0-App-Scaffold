---
name: tier0-sdk-openapi-restore
version: 0.2.0
description: "POST /openapi/v1/uns/restore — 恢复软删除的 UNS 节点"
---

# restore — `POST /openapi/v1/uns/restore`

将软删除（`hard_delete: false`）的节点恢复到可用状态。**硬删除的节点无法恢复**。

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsrestore(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | string | **是** | 要恢复的节点完整路径（必须处于软删除状态） |

## 响应结构

```typescript
{
  code: number;   // 200 = 成功
  msg: string;    // "success"
  data: {};       // 空对象，成功与否依靠外层 code/msg 判断
}
```

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
// 前提：该节点之前通过 delete（hard_delete: false）进行了软删除
const result = await unsApi.openapiv1unsrestore({
  path: 'Plant/Line1/Metric/Temperature',
});

if (result.code === 200) {
  console.log('节点已恢复');
} else {
  console.error('恢复失败:', result.msg, '（节点可能已被硬删除或路径不存在）');
}
```

> **注意**：如果尝试恢复一个从未被删除或已被硬删除的节点，接口会返回错误。
