import { z } from "zod";
import { data, queryRequestToFind, toQueryResult } from "@/lib/data";
import { recipes, type Recipe } from "@/data/collections";
import { can } from "@/lib/permissions";
import { HttpError } from "@/lib/route-handlers";
import type { AppUser } from "@/lib/users";
import type { QueryRequest, QueryResult } from "@/lib/component-kit/types";
import type { RecipeOption, RecipeRow } from "@/lib/mes-types";
import { staleRevision } from "./mes-errors";

const recipeCollection = () => data.collection(recipes);

export const recipeStepInput = z.object({
  seq: z.number().int().min(1).max(99),
  materialCode: z.string().trim().min(1, "物料编码必填").max(32),
  materialName: z.string().trim().min(1, "物料名称必填").max(64),
  qtyKg: z.number().gt(0, "投料量须大于 0").max(100000),
  tolerancePct: z.number().min(0).max(50),
});

export const recipeInput = z.object({
  code: z.string().trim().min(1, "配方编码必填").max(32),
  name: z.string().trim().min(1, "配方名称必填").max(64),
  productName: z.string().trim().min(1, "产品名称必填").max(64),
  version: z.string().trim().min(1, "版本必填").max(16),
  baseOutputKg: z.number().gt(0, "基准产量须大于 0").max(100000),
  steps: z.array(recipeStepInput).min(1, "至少一个投料步骤").max(30),
  notes: z.string().trim().max(500).optional(),
});
export type RecipeInput = z.infer<typeof recipeInput>;

function requireView(user: AppUser) {
  if (!can(user.roles, "view_batches")) throw new HttpError(403, "没有查看配方的权限");
}

function requireManage(user: AppUser) {
  if (!can(user.roles, "manage_recipes")) throw new HttpError(403, "没有维护配方的权限");
}

function toRow(recipe: Recipe): RecipeRow {
  return {
    id: recipe._id,
    revision: recipe._meta.revision,
    code: recipe.code,
    name: recipe.name,
    productName: recipe.productName,
    version: recipe.version,
    baseOutputKg: recipe.baseOutputKg,
    active: recipe.active,
    stepCount: recipe.steps.length,
    steps: recipe.steps,
    ...(recipe.notes ? { notes: recipe.notes } : {}),
  };
}

function normalizeSteps(steps: RecipeInput["steps"]): Recipe["steps"] {
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  const seqs = new Set(sorted.map((step) => step.seq));
  if (seqs.size !== sorted.length) throw new HttpError(400, "投料步骤序号不能重复");
  return sorted;
}

export async function queryRecipes(user: AppUser, request: QueryRequest): Promise<QueryResult<RecipeRow>> {
  requireView(user);
  const { filter, sort, page, pageSize } = queryRequestToFind(request);
  const scoped =
    request.scope === "ACTIVE" ? { $and: [filter, { active: true }] }
      : request.scope === "INACTIVE" ? { $and: [filter, { active: false }] }
        : filter;
  const { list, byActive } = await data.queryBatch({
    list: recipeCollection().query.findPage(scoped, { sort: sort ?? { code: 1 }, page, pageSize }),
    byActive: recipeCollection().query.countBy("active", filter),
  });
  const count = (value: boolean) => byActive.find((entry) => entry.value === value)?.count ?? 0;
  return toQueryResult(list, {
    map: toRow,
    groups: [
      { value: "ACTIVE", label: "启用", count: count(true) },
      { value: "INACTIVE", label: "停用", count: count(false) },
    ],
  });
}

export async function listActiveRecipeOptions(user: AppUser): Promise<RecipeOption[]> {
  requireView(user);
  const items = await recipeCollection().find({ active: true }, { sort: { code: 1 }, limit: 200 }).toArray();
  return items.map((recipe) => ({
    id: recipe._id,
    code: recipe.code,
    name: recipe.name,
    productName: recipe.productName,
    version: recipe.version,
    baseOutputKg: recipe.baseOutputKg,
  }));
}

export async function getRecipeForBatch(id: string): Promise<Recipe> {
  const { items } = await recipeCollection().get([id]);
  const recipe = items[0];
  if (!recipe) throw new HttpError(404, "配方不存在");
  return recipe;
}

export async function createRecipe(user: AppUser, input: RecipeInput): Promise<RecipeRow> {
  requireManage(user);
  const { value } = await recipeCollection().insertOne(
    {
      code: input.code,
      name: input.name,
      productName: input.productName,
      version: input.version,
      baseOutputKg: input.baseOutputKg,
      active: true,
      steps: normalizeSteps(input.steps),
      ...(input.notes ? { notes: input.notes } : {}),
    },
    { returnDocument: "after" },
  );
  return toRow(value);
}

export async function updateRecipe(
  user: AppUser,
  id: string,
  input: RecipeInput,
  expectedRevision: number,
): Promise<RecipeRow> {
  requireManage(user);
  const update: Record<string, unknown> = {
    $set: {
      code: input.code,
      name: input.name,
      productName: input.productName,
      version: input.version,
      baseOutputKg: input.baseOutputKg,
      steps: normalizeSteps(input.steps),
      ...(input.notes ? { notes: input.notes } : {}),
    },
    ...(input.notes ? {} : { $unset: { notes: "" } }),
  };
  const updated = await recipeCollection().findOneAndUpdate({ _id: id }, update, {
    expectedRevision,
    returnDocument: "after",
  }).catch(staleRevision);
  if (!updated) throw new HttpError(404, "配方不存在");
  return toRow(updated);
}

export async function setRecipeActive(user: AppUser, id: string, active: boolean): Promise<RecipeRow> {
  requireManage(user);
  const updated = await recipeCollection().findOneAndUpdate(
    { _id: id, active: !active },
    { $set: { active } },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, active ? "配方已是启用状态或不存在" : "配方已是停用状态或不存在");
  return toRow(updated);
}
