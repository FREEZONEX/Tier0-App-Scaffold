import type {SelectOption} from "./types";
export const CODE_RULE_SEGMENT_TYPES: SelectOption[] = [
  { value: "DATE", label: "日期时间" },
  { value: "SERIAL", label: "流水号" },
  { value: "FIXED", label: "固定值" },
  { value: "BIZ_FIELD", label: "业务字段" },
];

export const CODE_RULE_DATE_FORMATS = ["yy", "yyyy", "yyMM", "yyyyMM", "yyyyMMdd", "yyMMdd"] as const;

export const CODE_RULE_PAD_MODES: SelectOption[] = [
  { value: "NONE", label: "无" },
  { value: "LEFT", label: "左补位" },
  { value: "RIGHT", label: "右补位" },
];
