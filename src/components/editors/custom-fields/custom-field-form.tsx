"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * 创建 / 编辑自定义字段 (06 §3; 901_cc_add_field.png, 902_cc_field_types.png, 903_cc_type_*.png,
 * 904/905 引用字段级联, 906 批量编辑选项, 907 单选框, 908 编辑关联引用).
 *
 * Single column form, labels on the left: * 字段名称, * 字段类型 (创建后不可修改), 字段属性
 * (per type), type specific items (显示精度 / 设置可选范围 + 显示方式 / 上传限制 / 引用字段),
 * 引导文字, 提示说明 0/50, 取消 / 保存. Leaving with unsaved changes (取消, menu links, closing
 * the tab) asks first.
 */
import { useBlocker } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AsyncView } from "@/components/data/async-view";
import { FieldLabel } from "@/components/forms/field-label";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/kit/ui/checkbox";
import { Input, TextArea } from "@/components/kit/ui/input";
import { NumberInput } from "@/components/kit/ui/number-input";
import { Select } from "@/components/kit/ui/select";

import { useRequest } from "@/lib/hooks";
import { CUSTOM_FIELD_TYPES, type CustomFieldInput, type FieldType, type ReferenceTreeNode } from "@/lib/component-kit/types";
import { DIRTY_GUARD_MESSAGE, DIRTY_GUARD_TITLE, isSameValue } from "@/lib/component-kit/use-dirty-guard";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import {
  ATTACHMENT_LIMITS,
  changeDraftType,
  DISPLAY_MODE_OPTIONS,
  DISPLAY_PRECISION_OPTIONS,
  draftToInput,
  IMAGE_LIMITS,
  NAME_MAX_LENGTH,
  PLACEHOLDER_MAX_LENGTH,
  TOOLTIP_MAX_LENGTH,
  validateDraft,
  type DraftErrors,
  type FieldDraft,
} from "@/components/editors/custom-fields/field-type-meta";
import { OptionListEditor } from "@/components/editors/custom-fields/option-list-editor";
import { ReferenceCascader } from "@/components/editors/custom-fields/reference-cascader";

export interface CustomFieldFormProps {
  objectCode: string;
  mode: "create" | "edit";
  initial: FieldDraft;
  /** Saves the field; rejects to keep the form open (the caller shows the error). */
  onSubmit: (input: CustomFieldInput) => Promise<void>;
  /** Leave the page (after save or confirmed cancel). */
  onClose: () => void;
}

function FormRow({ label, required, htmlFor, children, error, className }: { label: string; required?: boolean; htmlFor?: string; children: ReactNode; error?: string; className?: string }) {
  return (
    <div className={cn("grid min-w-0 items-start gap-1.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4", className)}>
      <div className="pt-[5px]">
        <FieldLabel htmlFor={htmlFor} required={required} className="font-normal">
          {label}
        </FieldLabel>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {error ? (
          <p role="alert" className="text-sm leading-5 text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[#b2ed1d] bg-[#e7f9b9] px-3 py-2.5 text-sm leading-[22px] text-foreground">
      <Info className="mt-[3px] size-4 shrink-0 text-brand" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function ReferenceField({ objectCode, value, error, onChange }: { objectCode: string; value: string[]; error?: string; onChange: (path: string[]) => void }) {
  const api = useKitApi();
  const tree = useRequest(`reference-tree:${objectCode}`, (signal) =>
    api.getJson<ReferenceTreeNode[]>(apiUrl(`/api/meta/reference-tree/${objectCode}`), { signal }),
  );
  return (
    <AsyncView result={tree} isEmpty={() => false}>
      {(nodes) => <ReferenceCascader nodes={nodes} value={value} status={error ? "error" : undefined} onChange={(path) => onChange(path)} />}
    </AsyncView>
  );
}

export function CustomFieldForm({ objectCode, mode, initial, onSubmit, onClose }: CustomFieldFormProps) {
  const [draft, setDraft] = useState<FieldDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const leavingRef = useRef(false);

  const dirty = !isSameValue(draftToInput(draft), draftToInput(initial));
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !leavingRef.current,
    enableBeforeUnload: () => dirtyRef.current && !leavingRef.current,
    withResolver: true,
  });

  const patch = (next: Partial<FieldDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const cleared = { ...current };
      for (const key of Object.keys(next)) delete cleared[key as keyof DraftErrors];
      if ("options" in next) delete cleared.options;
      return cleared;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(draftToInput(draft));
      leavingRef.current = true;
      onClose();
    } catch {
      // The caller already reported the failure; keep the form for corrections.
    } finally {
      setSaving(false);
    }
  };

  const { type } = draft;
  const hasTexts = type === "TEXT" || type === "NUMBER" || type === "SINGLE_SELECT" || type === "MULTI_SELECT" || type === "HYPERLINK";
  const limits = type === "ATTACHMENT" ? ATTACHMENT_LIMITS : IMAGE_LIMITS;

  return (
    <>
      <form className="flex w-full max-w-[680px] flex-col gap-5" onSubmit={(event) => void submit(event)} noValidate>
        <FormRow label="字段名称" required htmlFor="custom-field-name" error={errors.name}>
          <Input
            id="custom-field-name"
            placeholder="请输入"
            maxLength={NAME_MAX_LENGTH}
            status={errors.name ? "error" : undefined}
            value={draft.name}
            onChange={(value) => patch({ name: value })}
          />
        </FormRow>

        <FormRow label="字段类型" required>
          <Select<FieldType>
            aria-label="字段类型"
            disabled={mode === "edit"}
            options={CUSTOM_FIELD_TYPES.map((item) => ({ value: item.key, label: item.label }))}
            value={type}
            onChange={(next) => {
              if (next && next !== type) {
                setDraft((current) => changeDraftType(current, next));
                setErrors({});
              }
            }}
          />
          {mode === "edit" ? <span className="text-xs text-text-tertiary">字段类型创建后不可修改</span> : null}
        </FormRow>

        {type === "RELATION_REFERENCE" ? (
          <FormRow label="引用字段" required error={errors.referencePath}>
            <ReferenceField objectCode={objectCode} value={draft.referencePath} error={errors.referencePath} onChange={(path) => patch({ referencePath: path })} />
            <span className="text-xs text-text-tertiary">引用关联对象上的字段，值只读并自动同步</span>
          </FormRow>
        ) : (
          <FormRow label="字段属性" error={errors.decimalPlaces ?? errors.defaultValue ?? errors.maxCount ?? errors.maxSizeMb}>
            <div className="flex min-w-0 flex-col gap-3 pt-[5px]">
              <Checkbox checked={draft.required} onChange={(checked) => patch({ required: checked })}>
                必填
              </Checkbox>
              {type === "TEXT" ? (
                <Checkbox checked={draft.multiline} onChange={(checked) => patch({ multiline: checked })}>
                  多行
                </Checkbox>
              ) : null}
              {type === "NUMBER" ? (
                <>
                  <Checkbox checked={draft.thousandSeparator} onChange={(checked) => patch({ thousandSeparator: checked })}>
                    显示千分位分割符
                  </Checkbox>
                  <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
                    <Checkbox checked={draft.useDecimalPlaces} onChange={(checked) => patch({ useDecimalPlaces: checked })}>
                      小数位数
                    </Checkbox>
                    {draft.useDecimalPlaces ? (
                      <NumberInput
                        aria-label="小数位数"
                        className="w-32"
                        min={0}
                        max={6}
                        precision={0}
                        suffix="位"
                        status={errors.decimalPlaces ? "error" : undefined}
                        value={draft.decimalPlaces}
                        onChange={(value) => patch({ decimalPlaces: value })}
                      />
                    ) : null}
                  </div>
                  <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
                    <Checkbox checked={draft.useDefaultValue} onChange={(checked) => patch({ useDefaultValue: checked })}>
                      默认值
                    </Checkbox>
                    {draft.useDefaultValue ? (
                      <NumberInput
                        aria-label="默认值"
                        className="w-44"
                        precision={draft.useDecimalPlaces && draft.decimalPlaces !== null ? draft.decimalPlaces : 6}
                        thousandSeparator={draft.thousandSeparator}
                        placeholder="请输入默认值"
                        status={errors.defaultValue ? "error" : undefined}
                        value={draft.defaultValue}
                        onChange={(value) => patch({ defaultValue: value })}
                      />
                    ) : null}
                  </div>
                </>
              ) : null}
              {type === "DATETIME" ? (
                <Checkbox checked={draft.defaultNow} onChange={(checked) => patch({ defaultNow: checked })}>
                  默认值：当前时间
                </Checkbox>
              ) : null}
              {type === "SINGLE_SELECT" || type === "MULTI_SELECT" ? (
                <Checkbox checked={draft.allowUserAddOption} onChange={(checked) => patch({ allowUserAddOption: checked })}>
                  允许用户添加选项
                </Checkbox>
              ) : null}
              {type === "IMAGE" || type === "ATTACHMENT" ? (
                <>
                  <Notice>
                    {type === "IMAGE"
                      ? `使用时最多上传${draft.maxCount ?? limits.maxCount}张图片，单张不超过${draft.maxSizeMb ?? limits.defaultSizeMb}MB`
                      : `使用时最多上传${draft.maxCount ?? limits.maxCount}个附件；支持上传大小在${draft.maxSizeMb ?? limits.defaultSizeMb}MB以内的所有格式附件，支持在线预览图片(jpg，png，jpeg)和PDF。`}
                  </Notice>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <span>最多上传</span>
                    <NumberInput
                      aria-label="最多上传数量"
                      className="w-24"
                      min={1}
                      max={limits.maxCount}
                      precision={0}
                      status={errors.maxCount ? "error" : undefined}
                      value={draft.maxCount}
                      onChange={(value) => patch({ maxCount: value })}
                    />
                    <span>{type === "IMAGE" ? "张，单张不超过" : "个，单个不超过"}</span>
                    <NumberInput
                      aria-label="单个文件大小上限"
                      className="w-24"
                      min={0.1}
                      max={limits.maxSizeMb}
                      precision={1}
                      suffix="MB"
                      status={errors.maxSizeMb ? "error" : undefined}
                      value={draft.maxSizeMb}
                      onChange={(value) => patch({ maxSizeMb: value })}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </FormRow>
        )}

        {type === "DATETIME" ? (
          <FormRow label="显示精度" required>
            <Select
              aria-label="显示精度"
              options={DISPLAY_PRECISION_OPTIONS}
              value={draft.displayPrecision}
              onChange={(value) => {
                if (value) patch({ displayPrecision: value });
              }}
            />
          </FormRow>
        ) : null}

        {type === "SINGLE_SELECT" || type === "MULTI_SELECT" ? (
          <>
            <FormRow label="设置可选范围">
              <OptionListEditor type={type} options={draft.options} error={errors.options} onChange={(options) => patch({ options })} />
            </FormRow>
            <FormRow label="显示方式" required>
              <Select
                aria-label="显示方式"
                options={DISPLAY_MODE_OPTIONS}
                value={draft.displayMode}
                onChange={(value) => {
                  if (value) patch({ displayMode: value });
                }}
              />
            </FormRow>
          </>
        ) : null}

        {hasTexts ? (
          <>
            <FormRow label="引导文字" htmlFor="custom-field-placeholder">
              <Input
                id="custom-field-placeholder"
                placeholder="填写完显示在框里"
                maxLength={PLACEHOLDER_MAX_LENGTH}
                value={draft.placeholder}
                onChange={(value) => patch({ placeholder: value })}
              />
            </FormRow>
            <FormRow label="提示说明" htmlFor="custom-field-tooltip">
              <TextArea
                id="custom-field-tooltip"
                placeholder="请输入"
                rows={4}
                maxLength={TOOLTIP_MAX_LENGTH}
                showCount
                value={draft.tooltip}
                onChange={(value) => patch({ tooltip: value })}
              />
            </FormRow>
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <span aria-hidden="true" className="hidden sm:block" />
          <div className="flex items-center gap-3">
            <Button variant="outline" className="min-w-[88px]" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="primary" className="min-w-[88px]" loading={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
        title={DIRTY_GUARD_TITLE}
        description={DIRTY_GUARD_MESSAGE}
        onConfirm={() => {
          if (blocker.status === "blocked") {
            leavingRef.current = true;
            blocker.proceed();
          }
        }}
      />
    </>
  );
}
