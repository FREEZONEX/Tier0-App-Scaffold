"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * 打印模板 新建 / 编辑 / 查看（spec §4「打印模板设计器（平台）→ 应用内打印模板管理」）: full-screen
 * modal — 基本信息 (模板编码 留空自动生成、* 模板名称、* 适用对象、版式 卡片 / 标签、显示二维码、状态、
 * 排序、备注), 字段布局 (* 表头字段 选择与排序、明细表、明细字段), live 预览. Built-in templates are
 * editable (not deletable).
 */
import { useEffect, useState, type ReactNode } from "react";
import { AsyncView } from "@/components/data/async-view";
import { FieldLabel } from "@/components/forms/field-label";
import { Button } from "@/components/ui/button";
import { FullscreenModal } from "@/components/kit/meta/index";
import { Input, TextArea } from "@/components/kit/ui/input";
import { NumberInput } from "@/components/kit/ui/number-input";
import { RadioGroup } from "@/components/kit/ui/radio";
import { Select } from "@/components/kit/ui/select";

import { useRequest } from "@/lib/hooks";
import { useKitAdapter } from "@/components/kit/provider";
import type { PrintTemplate, PrintTemplateField } from "@/lib/component-kit/types";
import { isSameValue } from "@/lib/component-kit/use-dirty-guard";
import {  } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { FieldOrderPicker } from "@/components/editors/print-templates/field-order-picker";
import { PrintTemplatePreview } from "@/components/editors/print-templates/print-template-preview";

export type PrintTemplateEditorMode = "create" | "edit" | "view";

export interface PrintTemplateInput {
  code: string | null;
  name: string;
  objectCode: string;
  layout: "CARD" | "LABEL";
  headerFields: PrintTemplateField[];
  detailSection: string | null;
  detailFields: PrintTemplateField[];
  showQrCode: boolean;
  enabled: boolean;
  sortOrder: number;
  remark: string | null;
}

export interface PrintTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PrintTemplateEditorMode;
  templateId: string | null;
  onSubmit: (input: PrintTemplateInput) => Promise<void>;
}

type TemplateRecord = PrintTemplate & { remark: string | null; sortOrder: number };

interface TemplateOptions {
  objectCode: string;
  headerFields: PrintTemplateField[];
  detailSections: { key: string; label: string; fields: PrintTemplateField[] }[];
}

const LAYOUT_OPTIONS = [
  { value: "CARD", label: "卡片（表头字段 + 明细表）" },
  { value: "LABEL", label: "标签（带二维码）" },
];

function emptyInput(): PrintTemplateInput {
  return { code: null, name: "", objectCode: "", layout: "CARD", headerFields: [], detailSection: null, detailFields: [], showQrCode: false, enabled: true, sortOrder: 0, remark: null };
}

function inputFromRecord(record: TemplateRecord): PrintTemplateInput {
  return {
    code: record.code,
    name: record.name,
    objectCode: record.objectCode,
    layout: record.layout,
    headerFields: record.headerFields,
    detailSection: record.detailSection,
    detailFields: record.detailFields,
    showQrCode: record.showQrCode,
    enabled: record.enabled,
    sortOrder: record.sortOrder ?? 0,
    remark: record.remark,
  };
}

function Row({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 items-start gap-1.5 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-3">
      <div className="pt-[5px]">
        <FieldLabel required={required} className="font-normal">
          {label}
        </FieldLabel>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FieldLayout({
  draft,
  readOnly,
  errors,
  onChange,
}: {
  draft: PrintTemplateInput;
  readOnly: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<PrintTemplateInput>) => void;
}) {
  const api = useKitApi();
  const options = useRequest(`print-template-options:${draft.objectCode}`, (signal) => api.getJson<TemplateOptions>(apiUrl(`/api/system/print-template-options/${draft.objectCode}`), { signal }), {
    enabled: Boolean(draft.objectCode),
  });
  if (!draft.objectCode) return <p className="rounded-md bg-[#f5f7fa] px-3 py-6 text-center text-sm text-text-tertiary">请先选择适用对象</p>;
  return (
    <AsyncView result={options} isEmpty={() => false}>
      {(data) => {
        const section = data.detailSections.find((item) => item.key === draft.detailSection);
        return (
          <div className="flex min-w-0 flex-col gap-4">
            <Row label="表头字段" required error={errors.headerFields}>
              <FieldOrderPicker label="表头字段" candidates={data.headerFields} value={draft.headerFields} disabled={readOnly} error={Boolean(errors.headerFields)} onChange={(headerFields) => onChange({ headerFields })} />
            </Row>
            {draft.layout === "CARD" ? (
              <>
                <Row label="明细表">
                  <Select<string>
                    aria-label="明细表"
                    allowClear
                    disabled={readOnly || data.detailSections.length === 0}
                    placeholder={data.detailSections.length ? "不打印明细" : "该对象没有明细表"}
                    options={data.detailSections.map((item) => ({ value: item.key, label: item.label }))}
                    value={draft.detailSection}
                    onChange={(value) => onChange({ detailSection: value, detailFields: [] })}
                  />
                </Row>
                {section ? (
                  <Row label="明细字段">
                    <FieldOrderPicker label="明细字段" candidates={section.fields} value={draft.detailFields} disabled={readOnly} onChange={(detailFields) => onChange({ detailFields })} />
                  </Row>
                ) : null}
              </>
            ) : null}
          </div>
        );
      }}
    </AsyncView>
  );
}

function EditorBody({
  mode,
  initial,
  onCancel,
  onSubmit,
  onDirtyChange,
}: {
  mode: PrintTemplateEditorMode;
  initial: PrintTemplateInput;
  onCancel: () => void;
  onSubmit: (input: PrintTemplateInput) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const {printableObjects: PRINTABLE_OBJECTS = []} = useKitAdapter();
  const readOnly = mode === "view";
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = !readOnly && !isSameValue(draft, initial);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const patch = (next: Partial<PrintTemplateInput>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const cleared = { ...current };
      for (const key of Object.keys(next)) delete cleared[key];
      return cleared;
    });
  };

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!draft.name.trim()) found.name = "请输入模板名称";
    if (!draft.objectCode) found.objectCode = "请选择适用对象";
    if (draft.headerFields.length === 0) found.headerFields = "请至少选择一个表头字段";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSubmit({
        ...draft,
        code: draft.code?.trim() || null,
        name: draft.name.trim(),
        remark: draft.remark?.trim() || null,
        headerFields: draft.headerFields.map((field) => ({ code: field.code, name: field.name.trim() })),
        detailSection: draft.layout === "CARD" ? draft.detailSection : null,
        detailFields: draft.layout === "CARD" && draft.detailSection ? draft.detailFields.map((field) => ({ code: field.code, name: field.name.trim() })) : [],
      });
    } catch {
      // Reported by the caller.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-5">
      <div className="grid min-w-0 flex-1 gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex min-w-0 flex-col gap-4">
            <h3 className="text-base font-semibold text-foreground">基本信息</h3>
            <Row label="模板编码">
              <Input aria-label="模板编码" placeholder="请输入，忽略将自动生成" maxLength={50} disabled={mode !== "create"} value={draft.code ?? ""} onChange={(value) => patch({ code: value })} />
            </Row>
            <Row label="模板名称" required error={errors.name}>
              <Input aria-label="模板名称" placeholder="请输入模板名称" maxLength={50} disabled={readOnly} status={errors.name ? "error" : undefined} value={draft.name} onChange={(value) => patch({ name: value })} />
            </Row>
            <Row label="适用对象" required error={errors.objectCode}>
              <Select<string>
                aria-label="适用对象"
                placeholder="请选择适用对象"
                disabled={mode !== "create"}
                status={errors.objectCode ? "error" : undefined}
                options={PRINTABLE_OBJECTS.map((option) => ({ value: String(option.value), label: option.label }))}
                value={draft.objectCode || null}
                onChange={(value) => patch({ objectCode: value ?? "", headerFields: [], detailSection: null, detailFields: [] })}
              />
            </Row>
            <Row label="版式">
              <RadioGroup<string> aria-label="版式" disabled={readOnly} options={LAYOUT_OPTIONS} value={draft.layout} onChange={(value) => patch({ layout: value === "LABEL" ? "LABEL" : "CARD" })} />
            </Row>
            <Row label="显示二维码">
              <RadioGroup<string>
                aria-label="显示二维码"
                disabled={readOnly}
                options={[
                  { value: "true", label: "是（内容为单据编码）" },
                  { value: "false", label: "否" },
                ]}
                value={draft.showQrCode ? "true" : "false"}
                onChange={(value) => patch({ showQrCode: value === "true" })}
              />
            </Row>
            <Row label="状态">
              <RadioGroup<string>
                aria-label="状态"
                disabled={readOnly}
                options={[
                  { value: "true", label: "启用" },
                  { value: "false", label: "停用" },
                ]}
                value={draft.enabled ? "true" : "false"}
                onChange={(value) => patch({ enabled: value === "true" })}
              />
            </Row>
            <Row label="排序">
              <NumberInput aria-label="排序" className="w-40" min={0} max={9999} precision={0} disabled={readOnly} value={draft.sortOrder} onChange={(value) => patch({ sortOrder: value ?? 0 })} />
            </Row>
            <Row label="备注">
              <TextArea aria-label="备注" rows={2} maxLength={200} placeholder="请输入备注" disabled={readOnly} value={draft.remark ?? ""} onChange={(value) => patch({ remark: value })} />
            </Row>
          </section>
          <section className="flex min-w-0 flex-col gap-4">
            <h3 className="text-base font-semibold text-foreground">字段布局</h3>
            <FieldLayout draft={draft} readOnly={readOnly} errors={errors} onChange={patch} />
          </section>
        </div>
        <section className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-0 xl:self-start">
          <h3 className="text-base font-semibold text-foreground">预览</h3>
          <div className="overflow-x-auto rounded-lg bg-[#eef1f6] p-4">
            <PrintTemplatePreview name={draft.name} layout={draft.layout} showQrCode={draft.showQrCode} headerFields={draft.headerFields} detailFields={draft.layout === "CARD" && draft.detailSection ? draft.detailFields : []} />
          </div>
          <p className="text-xs text-text-tertiary">预览中的 xxxx 为示例值；在业务列表中勾选数据点击「打印」即可按此模板打印真实数据。</p>
        </section>
      </div>
      <div className="sticky bottom-0 -mx-4 flex justify-center gap-3 border-t border-border-secondary bg-card px-4 py-3 sm:-mx-8">
        {readOnly ? (
          <Button variant="outline" className="min-w-32" onClick={onCancel}>
            返回
          </Button>
        ) : (
          <>
            <Button variant="outline" className="min-w-32" disabled={saving} onClick={onCancel}>
              取消
            </Button>
            <Button variant="primary" className="min-w-32" loading={saving} onClick={() => void submit()}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function PrintTemplateEditor({ open, onOpenChange, mode, templateId, onSubmit }: PrintTemplateEditorProps) {
  const api = useKitApi();
  const [dirty, setDirty] = useState(false);
  const record = useRequest(
    `print-template:${templateId ?? "new"}:${open}`,
    async (signal) => ({ record: templateId ? await api.getJson<TemplateRecord>(apiUrl(`/api/system/print-templates/${templateId}`), { signal }) : null }),
    { enabled: open, keepPreviousData: false },
  );
  const title = mode === "view" ? "查看打印模板" : mode === "edit" ? "编辑打印模板" : "新建打印模板";
  return (
    <FullscreenModal open={open} onOpenChange={onOpenChange} title={title} mode={mode} dirty={dirty} footer={() => null} bodyClassName="flex flex-col pb-0 sm:pb-0">
      {({ requestClose, forceClose }) =>
        open ? (
          <AsyncView result={record} isEmpty={() => false}>
            {(data) => (
              <EditorBody
                key={data.record?.id ?? "new"}
                mode={mode}
                initial={data.record ? inputFromRecord(data.record) : emptyInput()}
                onCancel={mode === "view" ? forceClose : requestClose}
                onSubmit={async (input) => {
                  await onSubmit(input);
                  setDirty(false);
                }}
                onDirtyChange={setDirty}
              />
            )}
          </AsyncView>
        ) : null
      }
    </FullscreenModal>
  );
}
