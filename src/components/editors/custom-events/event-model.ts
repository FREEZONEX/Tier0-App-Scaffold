/**
 * 自定义事件（01 §10）: editor option / record shapes of /api/system/custom-event-options and
 * /api/system/custom-events, the rule form model and its conversions, and client-side
 * condition checks (syntax + known variables) shared by the rule dialog and the
 * expression editor.
 */
import { checkExpression, formatVariable, statisticsSlotOf, type ExpressionError } from "@/lib/component-kit/expression";
import type { EventReceiver, EventRuleStep } from "@/lib/component-kit/types";

export interface EventVariableOption {
  label: string;
  value: string;
  code: string;
  type: string;
}

export interface EventVariableGroup {
  key: string;
  label: string;
  variables: EventVariableOption[];
}

export interface MessageTemplateItem {
  key: string;
  label: string;
  tooltip: string;
  required: boolean;
}

export interface CustomEventOptions {
  objectCode: string;
  objectName: string;
  moduleCode: string;
  variables: EventVariableGroup[];
  statisticsVariables: EventVariableGroup;
  timeFields: { code: string; name: string; value: string }[];
  watchFields: { code: string; name: string }[];
  personFields: { code: string; name: string; value: string }[];
  statisticsSlotCount: number;
  statisticsRecordLimit: number;
  statisticsOptions: { label: string; value: string }[];
  messageTemplate: { code: string; name: string; items: MessageTemplateItem[] };
  timeOffsetUnits: { value: string; label: string }[];
}

export type TriggerType = "DATA_CHANGE" | "SCHEDULED" | "TIME_FIELD";
export type TriggerAction = "CREATE" | "UPDATE" | "DELETE";

export interface CustomEventRuleRecord {
  id: string;
  code: string;
  objectCode: string;
  ruleName: string;
  enabled: string;
  triggerType: TriggerType;
  triggerAction: TriggerAction | null;
  createCondition: string | null;
  updateBeforeCondition: string | null;
  updateAfterCondition: string | null;
  watchFieldMode: string;
  watchFields: string[];
  deleteCondition: string | null;
  executeTime: string | null;
  frequency: string | null;
  statistics: { key: string; label: string; expression: string }[];
  scheduledCondition: string | null;
  timeField: string | null;
  timeOffsetType: string;
  timeOffsetValue: number | null;
  timeOffsetUnit: string;
  timeFieldCondition: string | null;
  events: EventRuleStep[];
}

export const ENABLED_OPTIONS = [
  { value: "ENABLED", label: "启用" },
  { value: "DISABLED", label: "停用" },
];

export const TRIGGER_TYPE_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: "DATA_CHANGE", label: "数据变更" },
  { value: "SCHEDULED", label: "定时触发" },
  { value: "TIME_FIELD", label: "按时间字段触发" },
];

export const TRIGGER_ACTION_OPTIONS: { value: TriggerAction; label: string }[] = [
  { value: "CREATE", label: "新增数据" },
  { value: "UPDATE", label: "编辑数据" },
  { value: "DELETE", label: "删除数据" },
];

export const FREQUENCY_OPTIONS = [
  { value: "ONCE", label: "执行一次" },
  { value: "DAILY", label: "每天执行" },
  { value: "WEEKLY", label: "每周同一天执行" },
  { value: "MONTHLY", label: "每月同一天执行" },
  { value: "YEARLY", label: "每年同一天执行" },
];

export const TIME_OFFSET_TYPE_OPTIONS = [
  { value: "AT_TIME", label: "当时" },
  { value: "ADVANCE", label: "提前" },
  { value: "DELAY", label: "延后" },
];

export const WATCH_MODE_OPTIONS = [
  { value: "ALL", label: "所有字段" },
  { value: "SPECIFIED", label: "指定字段" },
];

export const EVENT_TYPE_OPTIONS = [{ value: "MESSAGE_PUSH", label: "消息推送" }];
export const EVENT_OBJECT_OPTIONS = [{ value: "WECHAT_MESSAGE_NOTICE", label: "微信消息通知" }];

export const EXECUTE_RESULT_OPTIONS = [
  { value: "SUCCESS", label: "成功", color: "#166534" },
  { value: "FAIL", label: "失败", color: "#b91c1c" },
  { value: "SKIPPED", label: "已跳过", color: "#8c8c8c" },
  { value: "PROCESSING", label: "执行中", color: "#050b14" },
  { value: "RETRYING", label: "重试中", color: "#fa8c16" },
];

export interface StepForm {
  key: string;
  receivers: EventReceiver[];
  content: Record<string, string>;
  open: boolean;
}

export interface RuleForm {
  ruleName: string;
  enabled: string;
  triggerType: TriggerType;
  triggerAction: TriggerAction;
  createCondition: string;
  updateBeforeCondition: string;
  updateAfterCondition: string;
  watchFieldMode: string;
  watchFields: string[];
  deleteCondition: string;
  executeTime: string | null;
  frequency: string | null;
  statistics: string[];
  scheduledCondition: string;
  timeField: string | null;
  timeOffsetType: string;
  timeOffsetValue: number | null;
  timeOffsetUnit: string;
  timeFieldCondition: string;
  steps: StepForm[];
}

export type ConditionKey = "createCondition" | "updateBeforeCondition" | "updateAfterCondition" | "deleteCondition" | "scheduledCondition" | "timeFieldCondition";

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  createCondition: "新增数据满足条件",
  updateBeforeCondition: "编辑前的数据满足以下条件",
  updateAfterCondition: "编辑后的数据满足以下条件",
  deleteCondition: "删除的数据满足以下条件",
  scheduledCondition: "执行条件",
  timeFieldCondition: "到达触发时间后同时满足以下条件",
};

let stepSeed = 0;

function stepKey(): string {
  stepSeed += 1;
  return `step-${stepSeed}`;
}

export function emptyStep(): StepForm {
  return { key: stepKey(), receivers: [], content: {}, open: true };
}

export function emptyRuleForm(slotCount: number): RuleForm {
  return {
    ruleName: "",
    enabled: "ENABLED",
    triggerType: "DATA_CHANGE",
    triggerAction: "CREATE",
    createCondition: "",
    updateBeforeCondition: "",
    updateAfterCondition: "",
    watchFieldMode: "ALL",
    watchFields: [],
    deleteCondition: "",
    executeTime: null,
    frequency: null,
    statistics: Array.from({ length: slotCount }, () => ""),
    scheduledCondition: "",
    timeField: null,
    timeOffsetType: "AT_TIME",
    timeOffsetValue: null,
    timeOffsetUnit: "MINUTE",
    timeFieldCondition: "",
    steps: [emptyStep()],
  };
}

export function ruleFormFromRecord(record: CustomEventRuleRecord, slotCount: number): RuleForm {
  const statistics = Array.from({ length: slotCount }, () => "");
  for (const [index, item] of (record.statistics ?? []).entries()) {
    const slot = /^statistics(\d+)$/.exec(item.key ?? "")?.[1] ?? statisticsSlotOf([item.label ?? ""])?.toString() ?? String(index + 1);
    const position = Number(slot) - 1;
    if (position >= 0 && position < slotCount) statistics[position] = item.expression ?? "";
  }
  return {
    ruleName: record.ruleName ?? "",
    enabled: record.enabled === "DISABLED" ? "DISABLED" : "ENABLED",
    triggerType: record.triggerType ?? "DATA_CHANGE",
    triggerAction: record.triggerAction ?? "CREATE",
    createCondition: record.createCondition ?? "",
    updateBeforeCondition: record.updateBeforeCondition ?? "",
    updateAfterCondition: record.updateAfterCondition ?? "",
    watchFieldMode: record.watchFieldMode === "SPECIFIED" ? "SPECIFIED" : "ALL",
    watchFields: record.watchFields ?? [],
    deleteCondition: record.deleteCondition ?? "",
    executeTime: record.executeTime,
    frequency: record.frequency,
    statistics,
    scheduledCondition: record.scheduledCondition ?? "",
    timeField: record.timeField,
    timeOffsetType: record.timeOffsetType ?? "AT_TIME",
    timeOffsetValue: record.timeOffsetValue,
    timeOffsetUnit: record.timeOffsetUnit ?? "MINUTE",
    timeFieldCondition: record.timeFieldCondition ?? "",
    steps: (record.events?.length ? record.events : [null]).map((step) =>
      step
        ? {
            key: stepKey(),
            receivers: step.receivers ?? [],
            content: Object.fromEntries((step.contentItems ?? []).map((item) => [item.key, item.value ?? ""])),
            open: true,
          }
        : emptyStep(),
    ),
  };
}

/** Conditions shown for the current trigger settings. */
export function visibleConditions(form: Pick<RuleForm, "triggerType" | "triggerAction">): ConditionKey[] {
  if (form.triggerType === "SCHEDULED") return ["scheduledCondition"];
  if (form.triggerType === "TIME_FIELD") return ["timeFieldCondition"];
  if (form.triggerAction === "UPDATE") return ["updateBeforeCondition", "updateAfterCondition"];
  if (form.triggerAction === "DELETE") return ["deleteCondition"];
  return ["createCondition"];
}

/** Request body of POST / PUT /api/system/custom-events. */
export function ruleFormToInput(form: RuleForm, objectCode: string, template: readonly MessageTemplateItem[]) {
  return {
    objectCode,
    ruleName: form.ruleName.trim(),
    enabled: form.enabled,
    triggerType: form.triggerType,
    triggerAction: form.triggerType === "DATA_CHANGE" ? form.triggerAction : null,
    createCondition: form.createCondition,
    updateBeforeCondition: form.updateBeforeCondition,
    updateAfterCondition: form.updateAfterCondition,
    watchFieldMode: form.watchFieldMode,
    watchFields: form.watchFields,
    deleteCondition: form.deleteCondition,
    executeTime: form.executeTime,
    frequency: form.frequency,
    statistics: form.statistics
      .map((expression, index) => ({ key: `statistics${index + 1}`, label: `统计数据${index + 1}`, expression: expression ?? "" }))
      .filter((item) => item.expression.trim()),
    scheduledCondition: form.scheduledCondition,
    timeField: form.timeField,
    timeOffsetType: form.timeOffsetType,
    timeOffsetValue: form.timeOffsetValue,
    timeOffsetUnit: form.timeOffsetUnit,
    timeFieldCondition: form.timeFieldCondition,
    events: form.steps.map((step) => ({
      eventType: "MESSAGE_PUSH" as const,
      eventObject: "WECHAT_MESSAGE_NOTICE" as const,
      receivers: step.receivers,
      contentItems: template.map((item) => ({ key: item.key, label: item.label, value: step.content[item.key] ?? "" })),
    })),
  };
}

function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

/**
 * Variables the server resolves: option values (`${生产工单.工单编号}`, `${物料.物料名称}`), short
 * forms `${工单编号}`, relation paths by field name, ${系统.系统时间}; statistics slots for 定时触发.
 */
export function knownVariables(options: CustomEventOptions, withStatistics: boolean, configuredSlots: readonly number[] = []): Set<string> {
  const known = new Set<string>();
  const [objectGroup, ...others] = options.variables;
  for (const group of options.variables) for (const variable of group.variables) known.add(compact(variable.value));
  for (const variable of objectGroup?.variables ?? []) {
    known.add(compact(formatVariable([variable.label])));
    known.add(compact(formatVariable([options.objectName, variable.code])));
  }
  for (const group of others) {
    if (!group.key.startsWith("relation:")) continue;
    for (const variable of group.variables) {
      const inner = variable.value.slice(2, -1).split(".");
      const fieldName = inner[inner.length - 1];
      const relationCode = group.key.slice("relation:".length);
      const relation = objectGroup?.variables.find((item) => item.code === relationCode);
      if (relation) {
        known.add(compact(formatVariable([options.objectName, relation.label, fieldName])));
        known.add(compact(formatVariable([relation.label, fieldName])));
      }
    }
  }
  if (withStatistics) {
    for (const slot of configuredSlots) {
      known.add(compact(formatVariable([`统计数据${slot}`])));
      known.add(compact(formatVariable(["统计数据", `统计数据${slot}`])));
    }
  }
  return known;
}

/** Syntax + variable check of one condition; null when fine (empty is fine). */
export function checkCondition(text: string, known: Set<string> | null, withStatistics = false): ExpressionError | null {
  return checkExpression(text, {
    checkVariable: known
      ? (ref) => {
          if (known.has(compact(ref.raw))) return null;
          if (statisticsSlotOf(ref.path) !== null) {
            return withStatistics ? `${ref.raw} 未配置统计内容，请先在「统计数据」中选择` : `${ref.raw} 只能在定时触发中使用`;
          }
          return `字段「${ref.raw}」不存在`;
        }
      : undefined,
  });
}

/** Identity of a 提醒对象 entry (type + id / field). */
export function receiverKey(receiver: EventReceiver): string {
  return `${receiver.type}:${receiver.id ?? receiver.field ?? ""}`;
}
