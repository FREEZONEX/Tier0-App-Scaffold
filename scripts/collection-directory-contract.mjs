import assert from "node:assert/strict";

// 新生成的声明必须能在空环境中创建；运行时仍兼容既有 alias 的旧声明。
export function assertCollectionDirectory(definition, compiled) {
  assert.ok(
    Array.isArray(definition.directoryPath) && definition.directoryPath.length > 0,
    `${definition.alias}: declare directoryPath from the workspace root using verified business directories (see docs/app-data.md). New collections cannot fall back to a root-level App container.`,
  );
  assert.deepEqual(
    compiled.directoryPath,
    definition.directoryPath,
    `${definition.alias}: the installed SDK must preserve directoryPath in the ensure payload; align the SDK instead of dropping placement.`,
  );
}
