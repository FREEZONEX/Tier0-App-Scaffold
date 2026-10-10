"use client";

import { useKitAdapter } from "@/components/kit/provider";
import { useKitApi } from "@/components/kit/provider";


/**
 * 新增 / 编辑 / 查看编码规则: full-screen modal —「基础信息」规则编码 (留空自动生成) /
 * * 规则名称 / * 业务类型;「编码规则」preview box (CGRKyyyyMMdd000001 + 今日示例), 「⊕ 增行」, segment
 * table (拖拽柄, * 字段类型ⓘ, * 字段值, * 补位方式ⓘ, * 补位符号ⓘ, * 长度, * 是否显示ⓘ, 操作 删除).
 * 取消 / 保存; 查看 shows 返回 only.
 */
import { CircleHelp, CirclePlus, GripVertical } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AsyncView } from "@/components/data/async-view";
import { FieldLabel } from "@/components/forms/field-label";
import { Button } from "@/components/ui/button";
import { FullscreenModal } from "@/components/kit/meta/index";
import { TextButton } from "@/components/kit/ui/buttons";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { Input } from "@/components/kit/ui/input";
import { NumberInput } from "@/components/kit/ui/number-input";
import { Select } from "@/components/kit/ui/select";
import { Tooltip } from "@/components/kit/ui/tooltip";

import { useRequest } from "@/lib/hooks";
import { shanghaiToday } from "@/lib/component-kit/format";
import {
  CODE_RULE_DATE_FORMATS,
  CODE_RULE_PAD_MODES,
  CODE_RULE_SEGMENT_TYPES,
} from "@/lib/component-kit/code-rule-options";
import type { CodeRuleRecord, CodeRuleSegmentType } from "@/lib/component-kit/types";
import { isSameValue } from "@/lib/component-kit/use-dirty-guard";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import {
  businessPropertyLabel,
  codeRuleInput,
  codeRulePreviewText,
  draftFromCodeRule,
  emptyCodeRuleDraft,
  MAX_SEGMENTS,
  newSegment,
  validateCodeRuleDraft,
  withSegmentType,
  type CodeRuleDraft,
  type CodeRuleProblems,
  type SegmentRow,
} from "@/components/editors/code-rules/code-rule-model";

interface CodeRuleOptions {
  documentTypes: Record<string, { objectCode: string; fallback: string }>;
}

export type CodeRuleEditorMode = "create" | "edit" | "view";
export type CodeRuleInput = ReturnType<typeof codeRuleInput>;

export interface CodeRuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CodeRuleEditorMode;
  ruleId: string | null;
  /** Save; reject to keep the modal open (the caller reports the error). */
  onSubmit: (input: CodeRuleInput) => Promise<void>;
}

const YES_NO = [
  { value: "true", label: "是" },
  { value: "false", label: "否" },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#050b14] to-[#69b1ff]" aria-hidden="true" />
      {children}
    </h3>
  );
}

function HeaderWithTip({ title, tip, required }: { title: string; tip?: string; required?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {required ? (
        <FieldLabel required className="font-semibold">
          {title}
        </FieldLabel>
      ) : (
        title
      )}
      {tip ? (
        <Tooltip title={tip}>
          <CircleHelp className="size-3.5 text-text-tertiary" aria-label={tip} />
        </Tooltip>
      ) : null}
    </span>
  );
}

function EditorBody({
  mode,
  initial,
  documentTypes,
  onCancel,
  onSubmit,
  onDirtyChange,
}: {
  mode: CodeRuleEditorMode;
  initial: CodeRuleDraft;
  /** 业务类型 → 单据编号的内置回落说明（/api/system/code-rule-options）. */
  documentTypes: Record<string, { objectCode: string; fallback: string }>;
  onCancel: () => void;
  onSubmit: (input: CodeRuleInput) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const {codeRuleTypes: CODE_RULE_BUSINESS_TYPES = [], codeRuleProperties: CODE_RULE_BUSINESS_PROPERTIES = {}} = useKitAdapter();
  const readOnly = mode === "view";
  const [draft, setDraft] = useState<CodeRuleDraft>(initial);
  const [problems, setProblems] = useState<CodeRuleProblems>({});
  const [saving, setSaving] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const today = shanghaiToday();
  const documentHint = (draft.businessType ? documentTypes[draft.businessType] : null) ?? null;

  const dirty = !readOnly && !isSameValue(codeRuleInput(draft), codeRuleInput(initial));
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const patch = (next: Partial<CodeRuleDraft>) => {
    setDraft((current) => {
      const merged = { ...current, ...next };
      if (next.businessType !== undefined && next.businessType !== current.businessType) {
        const properties = CODE_RULE_BUSINESS_PROPERTIES[next.businessType ?? ""] ?? [];
        merged.segments = merged.segments.map((row) =>
          row.type === "BIZ_FIELD" && !properties.some((property) => property.key === row.value) ? { ...row, value: properties[0]?.key ?? "" } : row,
        );
      }
      return merged;
    });
    setProblems((current) => ({
      ...current,
      ...Object.fromEntries(Object.keys(next).map((key) => [key, undefined])),
      ...(next.businessType !== undefined ? { rows: undefined, segments: undefined } : {}),
    }));
  };

  const updateRow = (key: string, update: (row: SegmentRow) => SegmentRow) => {
    setDraft((current) => ({ ...current, segments: current.segments.map((row) => (row.key === key ? update(row) : row)) }));
    setProblems((current) => {
      if (!current.rows?.[key] && !current.segments) return current;
      const rows = { ...(current.rows ?? {}) };
      delete rows[key];
      return { ...current, rows, segments: undefined };
    });
  };

  const moveRow = (fromKey: string, toKey: string) => {
    setDraft((current) => {
      const segments = [...current.segments];
      const from = segments.findIndex((row) => row.key === fromKey);
      const to = segments.findIndex((row) => row.key === toKey);
      if (from < 0 || to < 0 || from === to) return current;
      const [row] = segments.splice(from, 1);
      segments.splice(to, 0, row);
      return { ...current, segments };
    });
  };

  const submit = async () => {
    const found = validateCodeRuleDraft(draft, CODE_RULE_BUSINESS_PROPERTIES);
    setProblems(found);
    if (Object.values(found).some(Boolean)) return;
    setSaving(true);
    try {
      await onSubmit(codeRuleInput(draft));
    } catch {
      // The caller reports the error; keep the form open.
    } finally {
      setSaving(false);
    }
  };

  const format = codeRulePreviewText(draft);
  const sample = codeRulePreviewText(draft, true, today);
  const properties = CODE_RULE_BUSINESS_PROPERTIES[draft.businessType ?? ""] ?? [];
  const rowErrors = Object.values(problems.rows ?? {});

  const columns: DataGridColumn<SegmentRow>[] = [
    {
      key: "type",
      title: <HeaderWithTip title="字段类型" required={!readOnly} tip="日期时间、流水号、固定值、业务字段按表格顺序拼接成编码" />,
      width: 160,
      ellipsis: false,
      render: (row) =>
        readOnly ? (
          (CODE_RULE_SEGMENT_TYPES.find((option) => option.value === row.type)?.label ?? "-")
        ) : (
          <Select<string>
            aria-label="字段类型"
            status={problems.rows?.[row.key] && !row.type ? "error" : undefined}
            options={CODE_RULE_SEGMENT_TYPES.map((option) => ({ value: String(option.value), label: option.label }))}
            value={row.type}
            onChange={(value) => {
              if (value) updateRow(row.key, (current) => withSegmentType(current, value as CodeRuleSegmentType, draft.businessType, CODE_RULE_BUSINESS_PROPERTIES));
            }}
          />
        ),
    },
    {
      key: "value",
      title: <HeaderWithTip title="字段值" required={!readOnly} />,
      width: 200,
      ellipsis: false,
      render: (row) => {
        if (readOnly) return row.type === "BIZ_FIELD" ? businessPropertyLabel(draft.businessType, row.value, CODE_RULE_BUSINESS_PROPERTIES) : row.value || "-";
        switch (row.type) {
          case "FIXED":
            return (
              <Input
                aria-label="固定值"
                placeholder="请输入固定值，如 CGRK"
                maxLength={20}
                status={problems.rows?.[row.key] && !row.value.trim() ? "error" : undefined}
                value={row.value}
                onChange={(value) => updateRow(row.key, (current) => ({ ...current, value }))}
              />
            );
          case "DATE":
            return (
              <Select<string>
                aria-label="日期格式"
                options={CODE_RULE_DATE_FORMATS.map((format) => ({ value: format, label: format }))}
                value={row.value}
                onChange={(value) => updateRow(row.key, (current) => ({ ...current, value: value ?? "yyyyMMdd" }))}
              />
            );
          case "SERIAL":
            return <Input aria-label="流水号" value="自增长数字" disabled />;
          case "BIZ_FIELD":
            return (
              <Select<string>
                aria-label="业务字段"
                placeholder={draft.businessType ? "请选择业务字段" : "请先选择业务类型"}
                disabled={!draft.businessType}
                status={problems.rows?.[row.key] ? "error" : undefined}
                options={properties.map((property) => ({ value: property.key, label: property.label }))}
                value={row.value || null}
                onChange={(value) => updateRow(row.key, (current) => ({ ...current, value: value ?? "" }))}
              />
            );
          default:
            return <Input aria-label="字段值" disabled placeholder="" />;
        }
      },
    },
    {
      key: "padMode",
      title: <HeaderWithTip title="补位方式" required={!readOnly} tip="流水号位数不足长度时，在左侧或右侧补位" />,
      width: 150,
      ellipsis: false,
      render: (row) =>
        readOnly ? (
          row.type === "SERIAL" ? (CODE_RULE_PAD_MODES.find((option) => option.value === row.padMode)?.label ?? "-") : ""
        ) : (
          <Select<string>
            aria-label="补位方式"
            disabled={row.type !== "SERIAL"}
            options={CODE_RULE_PAD_MODES.map((option) => ({ value: String(option.value), label: option.label }))}
            value={row.type === "SERIAL" ? row.padMode : null}
            placeholder=""
            onChange={(value) => updateRow(row.key, (current) => ({ ...current, padMode: (value ?? "LEFT") as SegmentRow["padMode"] }))}
          />
        ),
    },
    {
      key: "padChar",
      title: <HeaderWithTip title="补位符号" required={!readOnly} tip="用于补位的单个字符，如 0" />,
      width: 130,
      ellipsis: false,
      render: (row) =>
        readOnly ? (
          row.type === "SERIAL" ? row.padChar : ""
        ) : (
          <Input
            aria-label="补位符号"
            maxLength={1}
            disabled={row.type !== "SERIAL" || row.padMode === "NONE"}
            value={row.type === "SERIAL" ? row.padChar : ""}
            onChange={(value) => updateRow(row.key, (current) => ({ ...current, padChar: value }))}
          />
        ),
    },
    {
      key: "length",
      title: <HeaderWithTip title="长度" required={!readOnly} />,
      width: 120,
      ellipsis: false,
      render: (row) =>
        readOnly ? (
          row.type === "SERIAL" ? String(row.length ?? "") : ""
        ) : (
          <NumberInput
            aria-label="长度"
            min={1}
            max={12}
            precision={0}
            disabled={row.type !== "SERIAL"}
            value={row.type === "SERIAL" ? row.length : null}
            onChange={(value) => updateRow(row.key, (current) => ({ ...current, length: value }))}
          />
        ),
    },
    {
      key: "visible",
      title: <HeaderWithTip title="是否显示" required={!readOnly} tip="不显示的段参与流水号分组，但不拼接进编码" />,
      width: 130,
      ellipsis: false,
      render: (row) =>
        readOnly ? (
          row.visible ? "是" : "否"
        ) : (
          <Select<string>
            aria-label="是否显示"
            disabled={!row.type}
            options={YES_NO}
            value={row.visible ? "true" : "false"}
            onChange={(value) => updateRow(row.key, (current) => ({ ...current, visible: value !== "false" }))}
          />
        ),
    },
  ];
  if (!readOnly) {
    columns.push({
      key: "__actions",
      title: "操作",
      width: 80,
      fixed: "right",
      ellipsis: false,
      render: (row) => (
        <TextButton tone="danger" onClick={() => setDraft((current) => ({ ...current, segments: current.segments.filter((item) => item.key !== row.key) }))}>
          删除
        </TextButton>
      ),
    });
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-5">
      <section className="flex min-w-0 flex-col gap-4">
        <SectionTitle>基础信息</SectionTitle>
        {readOnly ? (
          <dl className="flex flex-wrap gap-x-10 gap-y-2 px-1 text-sm">
            <div className="flex gap-1">
              <dt className="text-text-secondary">规则编码：</dt>
              <dd>{draft.code}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-text-secondary">规则名称：</dt>
              <dd>{draft.name}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-text-secondary">业务类型：</dt>
              <dd>{CODE_RULE_BUSINESS_TYPES.find((option) => option.value === draft.businessType)?.label ?? draft.businessType}</dd>
            </div>
          </dl>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm sm:flex-row sm:items-center" data-required-rendered="true">
              <span className="shrink-0 text-foreground">规则编码：</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                  aria-label="规则编码"
                  placeholder="请输入规则编码，忽略将自动生成"
                  maxLength={30}
                  disabled={mode === "edit"}
                  status={problems.code ? "error" : undefined}
                  value={draft.code}
                  onChange={(value) => patch({ code: value })}
                />
                {problems.code ? <span className="text-xs text-danger">{problems.code}</span> : null}
              </span>
            </label>
            <div className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm sm:flex-row sm:items-center">
              <FieldLabel required className="shrink-0 font-normal">
                规则名称：
              </FieldLabel>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <Input aria-label="规则名称" placeholder="请输入规则名称" maxLength={50} status={problems.name ? "error" : undefined} value={draft.name} onChange={(value) => patch({ name: value })} />
                {problems.name ? <span className="text-xs text-danger">{problems.name}</span> : null}
              </span>
            </div>
            <div className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm sm:flex-row sm:items-center">
              <FieldLabel required className="shrink-0 font-normal">
                业务类型：
              </FieldLabel>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <Select<string>
                  aria-label="业务类型"
                  placeholder="请选择业务类型"
                  status={problems.businessType ? "error" : undefined}
                  options={CODE_RULE_BUSINESS_TYPES.map((option) => ({ value: String(option.value), label: option.label }))}
                  value={draft.businessType}
                  onChange={(value) => patch({ businessType: value })}
                />
                {problems.businessType ? <span className="text-xs text-danger">{problems.businessType}</span> : null}
              </span>
            </div>
          </div>
        )}
        {documentHint ? <p className="text-xs text-text-tertiary">该业务类型用于单据编号：规则启用后新建单据按此规则生成编号；停用或删除后回落系统内置规则（{documentHint.fallback}）。</p> : null}
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <SectionTitle>编码规则</SectionTitle>
        <div className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[#c9d6ea] bg-[#f5f7fa] px-4 py-4 text-center">
          {format ? (
            <>
              <span className="break-all font-mono text-2xl tracking-wide text-foreground sm:text-3xl">{format}</span>
              {sample !== format ? <span className="break-all text-xs text-text-tertiary">今日示例：{sample}</span> : null}
            </>
          ) : (
            <span className="text-2xl text-text-placeholder sm:text-3xl">请添加编码规则</span>
          )}
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<CirclePlus />} disabled={draft.segments.length >= MAX_SEGMENTS} onClick={() => setDraft((current) => ({ ...current, segments: [...current.segments, newSegment()] }))}>
              增行
            </Button>
            <span className="text-xs text-text-tertiary">已添加 {draft.segments.length} 行，拖动行首调整顺序</span>
          </div>
        ) : null}
        {problems.segments || rowErrors.length ? (
          <p role="alert" className="text-sm text-danger">
            {[problems.segments, ...rowErrors].filter(Boolean).join("；")}
          </p>
        ) : null}
        <DataGrid<SegmentRow>
          aria-label="编码规则"
          columns={columns}
          rows={draft.segments}
          rowKey={(row) => row.key}
          rowHeight="MID"
          showIndex={!readOnly}
          indexTitle=""
          indexWidth={56}
          renderIndex={() => <GripVertical className="mx-auto size-4 cursor-grab text-text-placeholder" aria-hidden="true" />}
          rowProps={
            readOnly
              ? undefined
              : (row) => ({
                  draggable: true,
                  onDragStart: (event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("input, [role='combobox']")) {
                      event.preventDefault();
                      return;
                    }
                    setDragKey(row.key);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", row.key);
                  },
                  onDragOver: (event) => {
                    if (!dragKey) return;
                    event.preventDefault();
                    if (dropKey !== row.key) setDropKey(row.key);
                  },
                  onDrop: (event) => {
                    event.preventDefault();
                    if (dragKey) moveRow(dragKey, row.key);
                    setDragKey(null);
                    setDropKey(null);
                  },
                  onDragEnd: () => {
                    setDragKey(null);
                    setDropKey(null);
                  },
                  className: cn(dragKey === row.key && "opacity-40", dropKey === row.key && dragKey && dragKey !== row.key && "[&>td]:border-t-2 [&>td]:border-t-brand"),
                })
          }
        />
      </section>

      <div className="sticky bottom-0 -mx-4 mt-auto flex justify-center gap-3 border-t border-border-secondary bg-card px-4 py-3 sm:-mx-8">
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

export function CodeRuleEditor({ open, onOpenChange, mode, ruleId, onSubmit }: CodeRuleEditorProps) {
  const api = useKitApi();
  const [dirty, setDirty] = useState(false);
  const record = useRequest(
    `code-rule:${ruleId ?? "new"}:${open}`,
    async (signal) => {
      const [record, options] = await Promise.all([
        ruleId ? api.getJson<CodeRuleRecord>(apiUrl(`/api/system/code-rules/${ruleId}`), { signal }) : Promise.resolve(null),
        api.getJson<CodeRuleOptions>(apiUrl(`/api/system/code-rule-options`), { signal }),
      ]);
      return { record, options };
    },
    { enabled: open, keepPreviousData: false },
  );
  const title = mode === "view" ? "查看编码规则" : mode === "edit" ? "编辑编码规则" : "新增编码规则";

  return (
    <FullscreenModal open={open} onOpenChange={onOpenChange} title={title} mode={mode} dirty={dirty} footer={() => null} bodyClassName="flex flex-col pb-0 sm:pb-0">
      {({ requestClose, forceClose }) =>
        open ? (
          <AsyncView result={record} isEmpty={() => false}>
            {(data) => (
              <EditorBody
                key={data.record?.id ?? "new"}
                mode={mode}
                initial={data.record ? draftFromCodeRule(data.record) : emptyCodeRuleDraft()}
                documentTypes={data.options.documentTypes ?? {}}
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
