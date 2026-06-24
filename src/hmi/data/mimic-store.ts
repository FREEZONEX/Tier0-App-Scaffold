import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";
import {
  listMimics,
  getMimic,
  createMimic,
  updateMimic,
  renameMimic,
  deleteMimic,
} from "@/services/mimics";
import type { MimicRow } from "@/db/schema";

/**
 * server fn 跨 server→client 边界返回的 DTO：`data` 是 Mimic 的 JSON 字符串。
 *
 * 为何不是结构化 Mimic：TanStack Start 对 server fn 返回值做编译期可序列化校验，
 * 而 Mimic.props 是 Record<string, unknown>，unknown 被判「不可序列化」而编译报错。
 * 用 JSON 字符串穿越边界绕开校验，客户端 parseDto 再用 mimicSchema 还原+二次校验。
 */
export interface MimicDto {
  id: string;
  name: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

/** 客户端用记录：data 已 parse 回结构化 Mimic。 */
export interface MimicRecord {
  id: string;
  name: string;
  data: Mimic;
  createdAt: string;
  updatedAt: string;
}

/** 选择器列表项：前端只需 id/name。 */
export interface MimicListItem {
  id: string;
  name: string;
}

const toDto = (row: MimicRow): MimicDto => ({
  id: row.id,
  name: row.name,
  data: JSON.stringify(row.data),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** 把 server fn 返回的 DTO 还原成结构化记录（客户端调用，含二次校验）。 */
export function parseDto(dto: MimicDto): MimicRecord {
  return {
    id: dto.id,
    name: dto.name,
    data: mimicSchema.parse(JSON.parse(dto.data)),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const listMimicsFn = createServerFn().handler(
  async (): Promise<MimicListItem[]> =>
    (await listMimics()).map((m) => ({ id: m.id, name: m.name })),
);

/** 取默认图：优先 name=default，否则最早一条。无图则建一张空白 default 兜底。 */
export const loadDefaultMimicFn = createServerFn().handler(async (): Promise<MimicDto> => {
  const list = await listMimics();
  const pick = list.find((m) => m.name === "default") ?? list[0];
  if (!pick) {
    const data = mimicSchema.parse({ meta: { name: "default" }, nodes: [] });
    return toDto(await createMimic("default", data));
  }
  const row = await getMimic(pick.id);
  if (!row) throw new Error("默认图加载失败");
  return toDto(row);
});

export const loadMimicFn = createServerFn()
  .inputValidator((input: { id: string }) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<MimicDto> => {
    const row = await getMimic(data.id);
    if (!row) throw new Error(`图纸不存在: ${data.id}`);
    return toDto(row);
  });

export const saveMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; data: Mimic }) =>
    z.object({ id: z.string().min(1), data: mimicSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<MimicDto> => toDto(await updateMimic(data.id, data.data)));

export const createMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => z.object({ name: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data }): Promise<MimicDto> => {
    const blank = mimicSchema.parse({ meta: { name: data.name }, nodes: [] });
    return toDto(await createMimic(data.name, blank));
  });

export const renameMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: z.string().min(1), name: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<MimicDto> => toDto(await renameMimic(data.id, data.name)));

export const deleteMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await deleteMimic(data.id);
    return { ok: true as const };
  });
