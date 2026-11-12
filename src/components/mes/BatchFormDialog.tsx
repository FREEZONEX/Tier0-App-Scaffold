"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/overlays/form-dialog";
import { FieldGroup, FormGrid } from "@/components/forms";
import { NumberInput } from "@/components/kit/ui/number-input";
import { Select } from "@/components/kit/ui/select";
import { DatePicker } from "@/components/kit/ui/date-picker";
import { AsyncView } from "@/components/data";
import { useRequest } from "@/lib/hooks";
import { apiUrl, requestJson } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import { formatKg, roundKg } from "@/lib/mes-domain";
import type { BatchDetail, RecipeOption } from "@/lib/mes-types";

interface DraftValues {
  recipeId: string | null;
  reactor: string;
  targetOutputKg: number | null;
  plannedStartAt: string | null;
}

const REACTORS = ["R-201", "R-202", "R-203", "R-204"];

function initialDraft(batch?: BatchDetail): DraftValues {
  if (batch) {
    return {
      recipeId: batch.recipe.id,
      reactor: batch.reactor,
      targetOutputKg: batch.targetOutputKg,
      plannedStartAt: batch.plannedStartAt,
    };
  }
  const start = new Date(Date.now() + 2 * 3600_000);
  start.setMinutes(0, 0, 0);
  return { recipeId: null, reactor: "R-201", targetOutputKg: null, plannedStartAt: start.toISOString() };
}

/**
 * Create a batch from an active recipe, or edit a draft batch (`batch` set).
 * Draft edits rescale planned step quantities on the server.
 */
export function BatchFormDialog({
  open,
  onOpenChange,
  batch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: BatchDetail;
  onSaved: (batch: BatchDetail) => void;
}) {
  const editing = Boolean(batch);
  const [draft, setDraft] = useState<DraftValues>(() => initialDraft(batch));
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DraftValues, string>>>({});

  const recipes = useRequest(
    "mes:recipe-options",
    (signal) => requestJson<RecipeOption[]>("/api/recipes", { signal }),
    { enabled: open && !editing },
  );
  const selectedRecipe = recipes.data?.find((recipe) => recipe.id === draft.recipeId);

  function close(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setDraft(initialDraft(batch));
      setErrors({});
    }
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!editing && !draft.recipeId) next.recipeId = "请选择配方";
    if (!draft.reactor.trim()) next.reactor = "请填写反应釜";
    if (!draft.targetOutputKg || draft.targetOutputKg <= 0) next.targetOutputKg = "目标产量须大于 0";
    if (!draft.plannedStartAt) next.plannedStartAt = "请选择计划开工时间";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setPending(true);
    try {
      const saved = batch
        ? await sendJson<BatchDetail>(apiUrl(`/api/batches/${batch._id}`), {
            method: "PATCH",
            body: {
              reactor: draft.reactor.trim(),
              targetOutputKg: draft.targetOutputKg,
              plannedStartAt: draft.plannedStartAt,
              expectedRevision: batch.revision,
            },
          })
        : await sendJson<BatchDetail>(apiUrl("/api/batches"), {
            method: "POST",
            body: {
              recipeId: draft.recipeId,
              reactor: draft.reactor.trim(),
              targetOutputKg: draft.targetOutputKg,
              plannedStartAt: draft.plannedStartAt,
            },
          });
      toast.success(batch ? `批次 ${saved.code} 已保存` : `已创建批次 ${saved.code}（草稿）`);
      setPending(false);
      onOpenChange(false);
      setErrors({});
      onSaved(saved);
    } catch (error) {
      setPending(false);
      toast.error(errorText(error));
    }
  }

  const ratio = selectedRecipe && draft.targetOutputKg ? draft.targetOutputKg / selectedRecipe.baseOutputKg : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={batch ? `修改批次 ${batch.code}` : "新建批次"}
      submitLabel={batch ? "保存修改" : "创建草稿"}
      pending={pending}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormGrid>
        {editing ? (
          <FieldGroup label="配方" className="md:col-span-2">
            <p className="text-sm">
              {batch?.recipe.code} · {batch?.recipe.name}（{batch?.recipe.version}）
            </p>
          </FieldGroup>
        ) : (
          <FieldGroup label="配方" htmlFor="batch-recipe" required error={errors.recipeId} className="md:col-span-2">
            <AsyncView result={recipes} isEmpty={(list) => list.length === 0}>
              {(list) => (
                <Select<string>
                  id="batch-recipe"
                  aria-label="配方"
                  options={list.map((recipe) => ({
                    value: recipe.id,
                    label: `${recipe.code} · ${recipe.name}（${recipe.version}）`,
                  }))}
                  value={draft.recipeId}
                  onChange={(value) => setDraft((current) => ({ ...current, recipeId: value }))}
                  placeholder="选择启用中的配方"
                  status={errors.recipeId ? "error" : undefined}
                  showSearch
                />
              )}
            </AsyncView>
          </FieldGroup>
        )}
        <FieldGroup label="反应釜" htmlFor="batch-reactor" required error={errors.reactor}>
          <Select<string>
            id="batch-reactor"
            aria-label="反应釜"
            options={REACTORS.map((value) => ({ value, label: value }))}
            value={draft.reactor}
            onChange={(value) => setDraft((current) => ({ ...current, reactor: value ?? "" }))}
            status={errors.reactor ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup
          label="目标产量"
          htmlFor="batch-target"
          required
          error={errors.targetOutputKg}
          helperText={
            selectedRecipe
              ? `配方基准 ${formatKg(selectedRecipe.baseOutputKg)}${ratio ? `，按 ${roundKg(ratio * 100)}% 缩放投料量` : ""}`
              : undefined
          }
        >
          <NumberInput
            id="batch-target"
            min={1}
            max={100000}
            precision={2}
            value={draft.targetOutputKg}
            onChange={(value) => setDraft((current) => ({ ...current, targetOutputKg: value }))}
            suffix="kg"
            status={errors.targetOutputKg ? "error" : undefined}
          />
        </FieldGroup>
        <FieldGroup label="计划开工" htmlFor="batch-start" required error={errors.plannedStartAt}>
          <DatePicker
            id="batch-start"
            aria-label="计划开工"
            precision="DATETIME_MINUTE"
            valueFormat="iso"
            value={draft.plannedStartAt}
            onChange={(value) => setDraft((current) => ({ ...current, plannedStartAt: value }))}
            status={errors.plannedStartAt ? "error" : undefined}
          />
        </FieldGroup>
      </FormGrid>
    </FormDialog>
  );
}
