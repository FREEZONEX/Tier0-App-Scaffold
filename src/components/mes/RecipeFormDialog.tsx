"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { FormDialog } from "@/components/overlays/form-dialog";
import { FieldGroup, FormGrid } from "@/components/forms";
import { Input } from "@/components/kit/ui/input";
import { NumberInput } from "@/components/kit/ui/number-input";
import { Button } from "@/components/ui";
import { apiUrl } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import type { RecipeRow } from "@/lib/mes-types";

interface StepDraft {
  key: number;
  materialCode: string;
  materialName: string;
  qtyKg: number | null;
  tolerancePct: number | null;
}

interface RecipeDraft {
  code: string;
  name: string;
  productName: string;
  version: string;
  baseOutputKg: number | null;
  notes: string;
  steps: StepDraft[];
}

type HeaderField = "code" | "name" | "productName" | "version" | "baseOutputKg";

let stepKey = 0;
const nextKey = () => (stepKey += 1);

function emptyStep(): StepDraft {
  return { key: nextKey(), materialCode: "", materialName: "", qtyKg: null, tolerancePct: 2 };
}

function initialDraft(recipe?: RecipeRow): RecipeDraft {
  if (!recipe) {
    return { code: "", name: "", productName: "", version: "V1.0", baseOutputKg: 1000, notes: "", steps: [emptyStep()] };
  }
  return {
    code: recipe.code,
    name: recipe.name,
    productName: recipe.productName,
    version: recipe.version,
    baseOutputKg: recipe.baseOutputKg,
    notes: recipe.notes ?? "",
    steps: recipe.steps.map((step) => ({
      key: nextKey(),
      materialCode: step.materialCode,
      materialName: step.materialName,
      qtyKg: step.qtyKg,
      tolerancePct: step.tolerancePct,
    })),
  };
}

/** Create a recipe, or edit one (`recipe` set) with optimistic revision checking. */
export function RecipeFormDialog({
  open,
  onOpenChange,
  recipe,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe?: RecipeRow;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RecipeDraft>(() => initialDraft(recipe));
  const [errors, setErrors] = useState<Partial<Record<HeaderField | "steps", string>>>({});
  const [pending, setPending] = useState(false);

  function close(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function setField<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key as HeaderField]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateStep(key: number, patch: Partial<StepDraft>) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    }));
    if (errors.steps) setErrors((current) => ({ ...current, steps: undefined }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!draft.code.trim()) next.code = "请填写配方编码";
    if (!draft.name.trim()) next.name = "请填写配方名称";
    if (!draft.productName.trim()) next.productName = "请填写产品名称";
    if (!draft.version.trim()) next.version = "请填写版本";
    if (!draft.baseOutputKg || draft.baseOutputKg <= 0) next.baseOutputKg = "基准产量须大于 0";
    if (draft.steps.length === 0) next.steps = "至少需要一个投料步骤";
    const incomplete = draft.steps.findIndex(
      (step) => !step.materialCode.trim() || !step.materialName.trim() || !step.qtyKg || step.qtyKg <= 0 || step.tolerancePct === null,
    );
    if (incomplete >= 0) next.steps = `步骤 ${incomplete + 1} 的物料编码、名称、投料量和允差都需填写`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    const body = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      productName: draft.productName.trim(),
      version: draft.version.trim(),
      baseOutputKg: draft.baseOutputKg,
      notes: draft.notes.trim(),
      steps: draft.steps.map((step, index) => ({
        seq: index + 1,
        materialCode: step.materialCode.trim(),
        materialName: step.materialName.trim(),
        qtyKg: step.qtyKg,
        tolerancePct: step.tolerancePct,
      })),
    };
    setPending(true);
    try {
      if (recipe) {
        await sendJson(apiUrl(`/api/recipes/${recipe.id}`), {
          method: "PUT",
          body: { ...body, expectedRevision: recipe.revision },
        });
        toast.success(`配方 ${body.code} 已保存`);
      } else {
        await sendJson(apiUrl("/api/recipes"), { method: "POST", body });
        toast.success(`已创建配方 ${body.code}`);
      }
      setPending(false);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setPending(false);
      toast.error(errorText(error));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={recipe ? `修改配方 ${recipe.code}` : "新建配方"}
      submitLabel={recipe ? "保存修改" : "创建配方"}
      pending={pending}
      size="lg"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormGrid>
        <FieldGroup label="配方编码" htmlFor="recipe-code" required error={errors.code}>
          <Input
            id="recipe-code"
            value={draft.code}
            maxLength={32}
            onChange={(value) => setField("code", value)}
            placeholder="例如 RCP-ADH-01"
            status={errors.code ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup label="配方名称" htmlFor="recipe-name" required error={errors.name}>
          <Input
            id="recipe-name"
            value={draft.name}
            maxLength={64}
            onChange={(value) => setField("name", value)}
            status={errors.name ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup label="产品" htmlFor="recipe-product" required error={errors.productName}>
          <Input
            id="recipe-product"
            value={draft.productName}
            maxLength={64}
            onChange={(value) => setField("productName", value)}
            status={errors.productName ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup label="版本" htmlFor="recipe-version" required error={errors.version}>
          <Input
            id="recipe-version"
            value={draft.version}
            maxLength={16}
            onChange={(value) => setField("version", value)}
            status={errors.version ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup label="基准产量" htmlFor="recipe-base" required error={errors.baseOutputKg}>
          <NumberInput
            id="recipe-base"
            min={1}
            max={100000}
            precision={2}
            suffix="kg"
            value={draft.baseOutputKg}
            onChange={(value) => setField("baseOutputKg", value)}
            status={errors.baseOutputKg ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup label="备注" htmlFor="recipe-notes">
          <Input
            id="recipe-notes"
            value={draft.notes}
            maxLength={500}
            onChange={(value) => setField("notes", value)}
          />
        </FieldGroup>
      </FormGrid>

      <fieldset className="mt-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-medium">
            投料步骤<span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
          </legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus />}
            onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, emptyStep()] }))}
            disabled={draft.steps.length >= 30}
          >
            添加步骤
          </Button>
        </div>
        {errors.steps ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.steps}
          </p>
        ) : null}
        <ol className="space-y-2">
          {draft.steps.map((step, index) => (
            <li
              key={step.key}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-start gap-2 rounded-[4px] border border-border p-2"
            >
              <span className="pt-2 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  aria-label={`步骤 ${index + 1} 物料编码`}
                  placeholder="物料编码"
                  value={step.materialCode}
                  maxLength={32}
                  onChange={(value) => updateStep(step.key, { materialCode: value })}
                />
                <Input
                  aria-label={`步骤 ${index + 1} 物料名称`}
                  placeholder="物料名称"
                  value={step.materialName}
                  maxLength={64}
                  onChange={(value) => updateStep(step.key, { materialName: value })}
                />
                <NumberInput
                  aria-label={`步骤 ${index + 1} 投料量`}
                  placeholder="投料量"
                  min={0.01}
                  max={100000}
                  precision={2}
                  suffix="kg"
                  value={step.qtyKg}
                  onChange={(value) => updateStep(step.key, { qtyKg: value })}
                />
                <NumberInput
                  aria-label={`步骤 ${index + 1} 允差`}
                  placeholder="允差"
                  min={0}
                  max={50}
                  precision={1}
                  suffix="%"
                  value={step.tolerancePct}
                  onChange={(value) => updateStep(step.key, { tolerancePct: value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`删除步骤 ${index + 1}`}
                disabled={draft.steps.length <= 1}
                onClick={() =>
                  setDraft((current) => ({ ...current, steps: current.steps.filter((item) => item.key !== step.key) }))
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
      </fieldset>
    </FormDialog>
  );
}
