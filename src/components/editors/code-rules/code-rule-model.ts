/**
 * 编码配置: editable segment rows, preview text and client-side checks mirroring
 * services/system/code-rules.ts.
 */
import { CODE_RULE_DATE_FORMATS } from "@/lib/component-kit/code-rule-options";
import type { CodeRuleRecord, CodeRuleSegment, CodeRuleSegmentType } from "@/lib/component-kit/types";

/** 限制异常大的配置，应用可在服务端增加业务校验。 */
export const MAX_SEGMENTS = 50;

export interface SegmentRow {
  key: string;
  type: CodeRuleSegmentType | null;
  value: string;
  padMode: "NONE" | "LEFT" | "RIGHT";
  padChar: string;
  length: number | null;
  visible: boolean;
}

export interface CodeRuleDraft {
  code: string;
  name: string;
  businessType: string | null;
  remark: string;
  segments: SegmentRow[];
}

let rowSeed = 0;

export function newSegment(): SegmentRow {
  rowSeed += 1;
  return { key: `segment-${rowSeed}`, type: null, value: "", padMode: "LEFT", padChar: "0", length: 6, visible: true };
}

export function emptyCodeRuleDraft(): CodeRuleDraft {
  return { code: "", name: "", businessType: null, remark: "", segments: [] };
}

export function draftFromCodeRule(record: CodeRuleRecord): CodeRuleDraft {
  return {
    code: record.code,
    name: record.name,
    businessType: record.businessType,
    remark: record.remark ?? "",
    segments: record.segments.map((segment) => {
      rowSeed += 1;
      return {
        key: `segment-${rowSeed}`,
        type: segment.type,
        value: segment.value ?? "",
        padMode: segment.padMode ?? "LEFT",
        padChar: segment.padChar ?? "0",
        length: segment.length ?? 6,
        visible: segment.visible !== false,
      };
    }),
  };
}

/** Changing the 字段类型 resets the row to that type's defaults. */
export function withSegmentType(row: SegmentRow, type: CodeRuleSegmentType, businessType: string | null, properties: Record<string, {key: string; label: string}[]> = {}): SegmentRow {
  switch (type) {
    case "FIXED":
      return { ...row, type, value: "" };
    case "DATE":
      return { ...row, type, value: "yyyyMMdd" };
    case "SERIAL":
      return { ...row, type, value: "自增长数字", padMode: "LEFT", padChar: "0", length: 6 };
    default:
      return { ...row, type, value: properties[businessType ?? ""]?.[0]?.key ?? "" };
  }
}

export function businessPropertyLabel(businessType: string | null, key: string, properties: Record<string, {key: string; label: string}[]> = {}): string {
  return properties[businessType ?? ""]?.find((property) => property.key === key)?.label ?? key;
}

function segmentText(row: SegmentRow, businessType: string | null, sample: boolean, today: string): string {
  switch (row.type) {
    case "FIXED":
      return row.value;
    case "DATE": {
      if (!sample) return row.value;
      const [yyyy, mm, dd] = [today.slice(0, 4), today.slice(5, 7), today.slice(8, 10)];
      const yy = yyyy.slice(2);
      const map: Record<string, string> = { yy, yyyy, yyMM: `${yy}${mm}`, yyyyMM: `${yyyy}${mm}`, yyyyMMdd: `${yyyy}${mm}${dd}`, yyMMdd: `${yy}${mm}${dd}` };
      return map[row.value] ?? row.value;
    }
    case "SERIAL": {
      const length = Math.max(1, row.length ?? 1);
      const char = (row.padChar || "0").slice(0, 1);
      if (row.padMode === "LEFT") return "1".padStart(length, char);
      if (row.padMode === "RIGHT") return "1".padEnd(length, char);
      return "1";
    }
    case "BIZ_FIELD":
      return row.value ? `{${businessPropertyLabel(businessType, row.value)}}` : "";
    default:
      return "";
  }
}

/** 「CGRKyyyyMMdd000001」 (format) or 「CGRK20260917000001」 (sample with today's date). */
export function codeRulePreviewText(draft: Pick<CodeRuleDraft, "segments" | "businessType">, sample = false, today = ""): string {
  return draft.segments
    .filter((row) => row.visible && row.type)
    .map((row) => segmentText(row, draft.businessType, sample, today))
    .join("");
}

export interface CodeRuleProblems {
  code?: string;
  name?: string;
  businessType?: string;
  segments?: string;
  rows?: Record<string, string>;
}

export function validateCodeRuleDraft(draft: CodeRuleDraft, properties: Record<string, {key: string; label: string}[]> = {}): CodeRuleProblems {
  const problems: CodeRuleProblems = {};
  if (draft.code.trim() && !/^[A-Za-z0-9_-]{1,30}$/.test(draft.code.trim())) problems.code = "规则编码只能包含字母、数字、下划线或-，最多 30 位";
  if (!draft.name.trim()) problems.name = "请输入规则名称";
  else if (draft.name.trim().length > 50) problems.name = "规则名称最多 50 个字";
  if (!draft.businessType) problems.businessType = "请选择业务类型";
  if (draft.segments.length === 0) problems.segments = "请至少添加一行编码规则";
  else if (draft.segments.length > MAX_SEGMENTS) problems.segments = `编码规则最多 ${MAX_SEGMENTS} 行`;
  const rows: Record<string, string> = {};
  let serials = 0;
  draft.segments.forEach((row, index) => {
    const label = `第${index + 1}行`;
    switch (row.type) {
      case null:
        rows[row.key] = `${label}请选择字段类型`;
        break;
      case "FIXED":
        if (!row.value.trim()) rows[row.key] = `${label}字段值不能为空`;
        else if (row.value.trim().length > 20) rows[row.key] = `${label}固定值最多 20 个字符`;
        break;
      case "DATE":
        if (!(CODE_RULE_DATE_FORMATS as readonly string[]).includes(row.value)) rows[row.key] = `${label}请选择日期格式`;
        break;
      case "SERIAL":
        serials += 1;
        if (row.length === null || !Number.isInteger(row.length) || row.length < 1 || row.length > 12) rows[row.key] = `${label}长度只能是 1 到 12 的整数`;
        else if (row.padMode !== "NONE" && row.padChar.length !== 1) rows[row.key] = `${label}补位符号只能是 1 个字符`;
        break;
      case "BIZ_FIELD":
        if (!properties[draft.businessType ?? ""]?.some((property) => property.key === row.value)) rows[row.key] = `${label}请选择业务字段`;
        break;
      default:
        break;
    }
  });
  if (serials > 1) problems.segments = "流水号只能配置一行";
  if (Object.keys(rows).length) problems.rows = rows;
  return problems;
}

export function codeRuleInput(draft: CodeRuleDraft) {
  return {
    code: draft.code.trim() || null,
    name: draft.name.trim(),
    businessType: draft.businessType ?? "",
    remark: draft.remark.trim() || null,
    segments: draft.segments.map(
      (row): CodeRuleSegment => ({
        type: row.type ?? "FIXED",
        value: row.value,
        ...(row.type === "SERIAL" ? { padMode: row.padMode, padChar: row.padMode === "NONE" ? "" : row.padChar, length: row.length ?? undefined } : {}),
        visible: row.visible,
      }),
    ),
  };
}
