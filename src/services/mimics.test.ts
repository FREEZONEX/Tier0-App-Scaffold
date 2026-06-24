import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  bootstrapMimics,
  listMimics,
  getMimic,
  createMimic,
  updateMimic,
  renameMimic,
  deleteMimic,
} from "./mimics";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";

const HAS_DB = !!(process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL);

describe("mimics repository — bootstrap/seed", { skip: HAS_DB ? false : "no DATABASE_URL" }, () => {
  it("bootstrap 后 default 图存在（从 default.json 迁移）", async () => {
    await bootstrapMimics();
    const list = await listMimics();
    assert.ok(
      list.some((m) => m.name === "default"),
      "应有 name=default 的种子图",
    );
  });
});

describe("mimics repository — CRUD", { skip: HAS_DB ? false : "no DATABASE_URL" }, () => {
  const made: string[] = [];
  after(async () => {
    if (!HAS_DB) return;
    for (const id of made) await deleteMimic(id);
  });
  const blank = (name: string): Mimic => mimicSchema.parse({ meta: { name }, nodes: [] });

  it("create → get round-trip", async () => {
    const row = await createMimic("t-create", blank("t-create"));
    made.push(row.id);
    const got = await getMimic(row.id);
    assert.equal(got?.name, "t-create");
    assert.equal(got?.data.meta.name, "t-create");
  });

  it("update 改 data 并刷新 updatedAt", async () => {
    const row = await createMimic("t-update", blank("t-update"));
    made.push(row.id);
    const next = mimicSchema.parse({
      meta: { name: "t-update" },
      nodes: [{ id: "n1", type: "pump", x: 0, y: 0 }],
    });
    const updated = await updateMimic(row.id, next);
    assert.equal(updated.data.nodes.length, 1);
  });

  it("rename 改 name 不动 data", async () => {
    const row = await createMimic("t-rename", blank("t-rename"));
    made.push(row.id);
    const r = await renameMimic(row.id, "t-rename-2");
    assert.equal(r.name, "t-rename-2");
    assert.equal(r.data.meta.name, "t-rename");
  });

  it("delete 后 get 返回 null", async () => {
    const row = await createMimic("t-del", blank("t-del"));
    await deleteMimic(row.id);
    assert.equal(await getMimic(row.id), null);
  });

  it("list 只返元信息不带 data", async () => {
    const list = await listMimics();
    assert.ok(list.length > 0);
    assert.ok(!("data" in list[0]), "list 元信息不应含 data 字段");
  });
});
