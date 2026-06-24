import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";

/**
 * 仅本地「演示编辑」用：把编辑后的演示图写回 `src/hmi/data/demo-mimic.json`。
 *
 * 双重门控（绝不让运行时改源码文件）：
 * - 客户端：`VITE_DEMO_EDIT=1` 才进 demo-edit 态、才会调用本 fn（见 HmiPage）。
 * - 服务端：handler 再查一次 `import.meta.env.VITE_DEMO_EDIT`（VITE_ 变量编译期内联；
 *   生产 build 不设此 env → 内联为 undefined → 永远抛错拒绝）。
 *
 * fs 写入只在 dev server 进程内有效（cwd = 项目根）；node:fs 用动态 import 留在服务端，
 * 不进客户端 bundle。
 */
export const saveDemoFn = createServerFn({ method: "POST" })
  .inputValidator((input: { data: Mimic }) => z.object({ data: mimicSchema }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    if (import.meta.env.VITE_DEMO_EDIT !== "1") {
      throw new Error("演示编辑未开启（需本地 VITE_DEMO_EDIT=1）");
    }
    const { writeFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const path = resolve(process.cwd(), "src/hmi/data/demo-mimic.json");
    writeFileSync(path, JSON.stringify(data.data, null, 2) + "\n", "utf8");
    return { ok: true as const };
  });
