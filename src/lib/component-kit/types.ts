/** Generic field, form, query and view contracts. Applications supply object definitions and services. */

/* ------------------------------------------------------------------ */
/* Field model                                                          */
/* ------------------------------------------------------------------ */

export type FieldType =
  | "TEXT"
  | "NUMBER"
  | "DATETIME"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  /** Link to another object's record (customer, product, person…). */
  | "RELATION_OBJECT"
  /** Read-only attribute copied from a relation on the same record (e.g. customerName). */
  | "RELATION_ATTRIBUTE"
  /** Custom 关联引用: value pulled through a reference path, possibly multi-level. */
  | "RELATION_REFERENCE"
  | "IMAGE"
  | "ATTACHMENT"
  | "HYPERLINK";

/** Custom-field designer type names (自定义配置 字段类型) → FieldType, in 灵动 order. */
export const CUSTOM_FIELD_TYPES = [
  { key: "TEXT", label: "文本" },
  { key: "NUMBER", label: "数字" },
  { key: "DATETIME", label: "时间" },
  { key: "SINGLE_SELECT", label: "单选框" },
  { key: "MULTI_SELECT", label: "复选框" },
  { key: "IMAGE", label: "图片" },
  { key: "ATTACHMENT", label: "附件" },
  { key: "HYPERLINK", label: "超链接" },
  { key: "RELATION_REFERENCE", label: "关联引用" },
] as const satisfies readonly { key: FieldType; label: string }[];

export type FilterOperator =
  | "EQ"
  | "NE"
  | "LIKE"
  | "NOT_LIKE"
  | "IN"
  | "NOT_IN"
  | "BETWEEN"
  | "LT"
  | "LTE"
  | "GT"
  | "GTE"
  | "IS_NULL"
  | "NOT_NULL"
  /** Relative date range, value = DynamicDateValue. */
  | "DYNAMIC";

export type DisplayPrecision = "DATE" | "DATETIME_MINUTE" | "DATETIME_SECOND";

export interface SelectOption {
  value: string | number;
  label: string;
  /** CSS color for the option label/tag, e.g. "rgb(230,22,22)" or "#1f1f1f". */
  color?: string | null;
  isDefault?: boolean;
}

/**
 * Widget properties. Keys follow the 灵动 page-config `widget` JSON so the
 * dictionary transcribes one-to-one; a few replica-only keys are marked.
 */
export interface FieldWidget {
  placeholder?: string;
  /** Shown as ⓘ beside the label. */
  tooltip?: string;
  tipExpanded?: boolean;
  required?: boolean;
  readonly?: boolean;
  /** Replica: read-only once the record exists (codes, relations fixed after confirm). */
  readonlyOnEdit?: boolean;
  /** false = not rendered in this place (kept for data binding). */
  visible?: boolean;
  hidden?: boolean;
  /** Condition on sibling values for showing this form item, e.g. {triggerType:"DATA_CHANGE"}. */
  visibleWhen?: Record<string, unknown>;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  hasEditor?: boolean;
  suffix?: string;
  /** NUMBER */
  decimalPlaces?: number;
  integerPlaces?: number;
  thousandSeparator?: boolean;
  /** NUMBER: 展示时去掉尾随 0（灵动订单列表金额列「4,105」而不是「4,105.00」）。 */
  trimTrailingZeros?: boolean;
  minValue?: number;
  maxValue?: number;
  defaultValue?: unknown;
  /** DATETIME */
  displayPrecision?: DisplayPrecision;
  dateTimeDisplayType?: DisplayPrecision;
  isRange?: boolean;
  /** Replica: custom DATETIME 「默认值：当前时间」. */
  defaultNow?: boolean;
  /** SINGLE/MULTI_SELECT: DROPDOWN or FLAT; RELATION_OBJECT: POPUP or DROPDOWN. */
  displayMode?: "DROPDOWN" | "FLAT" | "POPUP" | "TEXT" | "COMPONENT" | "CUSTOM_PERSON_REF";
  allowUserAddOption?: boolean;
  selectionMode?: "SINGLE" | "MULTIPLE";
  showSearch?: boolean;
  /** Columns shown for a relation (dropdown label parts / popup columns). */
  displayFields?: string[];
  /** After picking a relation, copy picked-record fields into this record. */
  fillRules?: { sourceField: string; targetField: string }[];
  /** Fixed query params for the reference source, e.g. {status: 1}. */
  params?: Record<string, unknown>;
  /** The value is rendered by page-specific code (progress rings, rule summaries…). */
  businessRender?: boolean;
  /** Render override for list cells, e.g. "HYPERLINK" for code columns. */
  fieldType?: FieldType;
  /** Several form items edited together by one composite control. */
  combinationKey?: string;
  /** IMAGE / ATTACHMENT */
  maxSizeMb?: number;
  maxCount?: number;
  allowedExtensions?: string[];
  /** Import / export / print / mobile-card availability. */
  excelImportVisible?: boolean;
  excelExportVisible?: boolean;
  excelRequired?: boolean;
  excelTip?: string;
  printVisible?: boolean;
  mobileEditCard?: boolean;
  /** stockTransaction.qty: sign follows inbound/outbound. */
  signedByTxType?: boolean;
  /** Custom RELATION_REFERENCE: path of field codes starting at a relation of this object. */
  referencePath?: string[];
}

export interface ReferenceSpec {
  /** Target objectCode, or "person" / "department" / "position" for organization pickers. */
  objectCode: string;
  /** Field of the target shown as the label. */
  labelField: string;
  /** Field of the target stored as the value (replica tables use "id"). */
  valueField: string;
}

export interface FieldDef {
  /** Field code from the 灵动 dictionary (Drizzle property name). Custom fields use `${objectCode}${timestamp}`. */
  code: string;
  name: string;
  type: FieldType;
  widget: FieldWidget;
  options?: SelectOption[];
  /** RELATION_OBJECT target. */
  reference?: ReferenceSpec;
  /** List column: default width (px), fixed side, default visibility, sortable. */
  width?: number;
  fixed?: "left" | "right" | null;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  /** Search condition operators (first one is the default). */
  operators?: FilterOperator[];
  /** True for user-defined fields from 自定义配置. */
  custom?: boolean;
}

export interface SectionDef {
  key: string;
  label: string;
  type: "form" | "table";
  zone: "FORM_HEADER" | "FORM_DETAIL";
  /** For table sections: the child objectCode (its custom fields are appended as columns). */
  objectCode?: string;
  /** Form items / table columns in display order. */
  items: FieldDef[];
}

export type ModuleCode = "workorder" | "baseline" | "wms" | "stockflow" | "customEvent" | "system";

export interface ObjectCapabilities {
  views?: boolean;
  customFields?: boolean;
  importable?: boolean;
  exportable?: boolean;
  printable?: boolean;
  mobileCard?: boolean;
}

export interface ObjectDef {
  code: string;
  name: string;
  module: ModuleCode;
  /** Field holding the business code / number (shown as link in lists). */
  primaryField: string;
  /** Field holding the lifecycle status, when the object has one. */
  statusField?: string;
  /** Parent objectCode when this object is a detail (明细) object. */
  detailOf?: string;
  capabilities: ObjectCapabilities;
  searchConditions: FieldDef[];
  listColumns: FieldDef[];
  formSections: SectionDef[];
  defaultSorts?: SortSpec[];
  /** Default 二级分组 field of the built-in「全部」view. */
  groupingField?: string | null;
  /** Page size default. */
  defaultPageSize?: number;
}

/* ------------------------------------------------------------------ */
/* Stored value shapes                                                  */
/* ------------------------------------------------------------------ */

/** Multi-person / multi-relation values are stored as arrays of these. */
export interface RefValue {
  id: string;
  name: string;
  code?: string | null;
}

/** IMAGE / ATTACHMENT values. `url` is a data URL or an app file URL. */
export interface FileValue {
  uid: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

/* ------------------------------------------------------------------ */
/* Query model                                                          */
/* ------------------------------------------------------------------ */

export type DynamicDatePreset =
  | "TODAY"
  | "YESTERDAY"
  | "THIS_WEEK"
  | "LAST_WEEK"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "CUSTOM"
  | "CUSTOM_RANGE";

export interface DynamicDateValue {
  preset: DynamicDatePreset;
  /** CUSTOM_RANGE: past N units to current M units, e.g. {pastAmount:365, pastUnit:"DAY", currentAmount:1, currentUnit:"DAY"}. */
  pastAmount?: number;
  pastUnit?: "DAY" | "WEEK" | "MONTH";
  currentAmount?: number;
  currentUnit?: "DAY" | "WEEK" | "MONTH";
  /** CUSTOM: a fixed date "YYYY-MM-DD". */
  date?: string;
}

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  /** EQ/LIKE/…: scalar; IN/NOT_IN: array; BETWEEN: [from, to]; DYNAMIC: DynamicDateValue. */
  value?: unknown;
}

export interface SortSpec {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryRequest {
  filters?: QueryFilter[];
  sorts?: SortSpec[];
  page?: { current: number; pageSize: number };
  viewCode?: string;
  /** Selected 二级分组 chip value; "__ALL__" or undefined for all. */
  groupValue?: string | number | null;
  /** Page-specific quick scope, e.g. task list「我的任务」= "MINE". */
  scope?: string;
  /** Restrict to these record ids (drill-down links, print/export of selection). */
  ids?: string[];
}

export interface QueryResult<Row = Record<string, unknown>> {
  list: Row[];
  total: number;
  page: { current: number; pageSize: number };
  groups?: GroupCount[];
}

export interface GroupCount {
  value: string | number;
  label: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/* Preferences, views, effective config                                */
/* ------------------------------------------------------------------ */

export type RowHeight = "LOW" | "MID" | "HIGH";

export interface ColumnPref {
  hidden?: boolean;
  fixed?: "left" | "right" | null;
  order?: number;
  width?: number;
}

export interface UserListPrefs {
  columns: Record<string, ColumnPref>;
  sorts: SortSpec[];
  rowHeight: RowHeight;
  pageSize: number;
}

export type ViewIcon = "dark" | "green" | "blue" | "orange" | "red";

/** 使用范围: 所有人 / 与我相关（创建人本人）/ 指定人员 / 部门. */
export interface ViewScope {
  all?: boolean;
  /** 与我相关: visible to the view's creator (whoever opens the editor sees the tag「与我相关」). */
  mine?: boolean;
  personIds?: string[];
  departmentIds?: string[];
}

export interface ViewDef {
  code: string;
  objectCode: string;
  name: string;
  icon: ViewIcon;
  /** Built-in 「全部」 view cannot be deleted. */
  builtIn: boolean;
  groupingField: string | null;
  rowHeight: RowHeight;
  scope: ViewScope;
  /** Field permission: codes visible in this view (null = all). */
  visibleFields: string[] | null;
  /** Column order/hidden/fixed inside this view. */
  columns: Record<string, ColumnPref>;
  filters: QueryFilter[];
  sorts: SortSpec[];
  sortOrder: number;
  createdByName?: string | null;
  updatedAt?: string | null;
}

export interface EffectiveField extends FieldDef {
  /** Effective list column state after view + user prefs. */
  hidden?: boolean;
  order?: number;
}

export interface EffectiveSection extends SectionDef {
  items: EffectiveField[];
}

export interface EffectivePageConfig {
  objectCode: string;
  objectName: string;
  module: ModuleCode;
  primaryField: string;
  statusField?: string;
  capabilities: ObjectCapabilities;
  searchConditions: EffectiveField[];
  listColumns: EffectiveField[];
  formSections: EffectiveSection[];
  /** Views visible to the current user (views-capable objects only). */
  views: Pick<ViewDef, "code" | "name" | "icon" | "builtIn">[];
  activeView: ViewDef | null;
  prefs: UserListPrefs;
  groupingField: EffectiveField | null;
}

/* ------------------------------------------------------------------ */
/* Custom fields                                                        */
/* ------------------------------------------------------------------ */

export const CUSTOM_FIELD_LIMIT = 80;

export interface CustomFieldInput {
  name: string;
  type: FieldType;
  widget: FieldWidget;
  options?: SelectOption[];
}

export interface CustomFieldRecord extends CustomFieldInput {
  objectCode: string;
  fieldCode: string;
  sortOrder: number;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Excel import/export, print, mobile cards, notifications              */
/* ------------------------------------------------------------------ */

export type ImportMode = "ADD_ONLY" | "UPSERT";

export interface ImportRowResult {
  row: number;
  ok: boolean;
  message?: string;
  code?: string;
}

export interface ImportResult {
  logId: string;
  total: number;
  succeeded: number;
  failed: number;
  rows: ImportRowResult[];
}

export interface ExportRequest extends QueryRequest {
  fieldCodes: string[];
  /** Optional 起止页码 (inclusive) using `page.pageSize`. */
  pageFrom?: number;
  pageTo?: number;
}

export interface ExcelLog {
  id: string;
  type: "IMPORT" | "EXPORT";
  objectCode: string;
  userName: string;
  createdAt: string;
  result: "SUCCESS" | "PARTIAL" | "FAILED";
  detail: string;
  fileName: string | null;
  hasFile: boolean;
}

export interface ExcelFilePayload {
  fileName: string;
  columns: { code: string; name: string }[];
  rows: string[][];
}

export interface PrintTemplateField {
  code: string;
  name: string;
}

export interface PrintTemplate {
  id: string;
  code: string;
  name: string;
  objectCode: string;
  /** "CARD" = label/value grid + optional detail table; "LABEL" = compact label with QR code. */
  layout: "CARD" | "LABEL";
  headerFields: PrintTemplateField[];
  detailSection: string | null;
  detailFields: PrintTemplateField[];
  showQrCode: boolean;
  builtIn: boolean;
  enabled: boolean;
}

export interface PrintPage {
  title: string;
  qrValue: string | null;
  header: { label: string; value: string }[];
  detail: { columns: string[]; rows: string[][] } | null;
}

export type MobileCardKey = string;

export interface MobileCardConfig {
  key: MobileCardKey;
  titleFields: string[];
  indicatorField: string | null;
  displayFields: string[];
  /** Visual components, e.g. "progress". */
  components: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function fieldByCode<F extends FieldDef>(fields: readonly F[], code: string): F | undefined {
  return fields.find((field) => field.code === code);
}

export function optionLabel(field: Pick<FieldDef, "options"> | undefined, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const option = field?.options?.find((item) => String(item.value) === String(value));
  return option ? option.label : String(value);
}

/**
 * Every standard field of an object once, keyed by code. Form usages win over
 * list usages, list over search, because forms carry the most complete widget.
 */
export function objectFields(def: Pick<ObjectDef, "searchConditions" | "listColumns" | "formSections">): Map<string, FieldDef> {
  const fields = new Map<string, FieldDef>();
  for (const field of def.searchConditions) fields.set(field.code, field);
  for (const field of def.listColumns) fields.set(field.code, field);
  for (const section of def.formSections) {
    if (section.type !== "form") continue;
    for (const field of section.items) fields.set(field.code, field);
  }
  return fields;
}

/* ------------------------------------------------------------------ */
/* API response shapes of the metadata engine and system services      */
/* (appended by the metadata/system engine; see specs/architecture.md) */
/* ------------------------------------------------------------------ */

/** GET /api/meta/reference-options/$objectCode item (下拉参照「名称 | 编码」). */
export interface ReferenceOption {
  id: string;
  code: string | null;
  name: string;
  /** "名称 | 编码", or just the name when the object has no code. */
  label: string;
  /** The whole record keyed by field codes (for fillRules). */
  record: Record<string, unknown>;
}

/** GET /api/meta/reference-tree/$objectCode node (关联引用级联选择). */
export interface ReferenceTreeNode {
  /** Field code at this level; a referencePath is the codes from the root down. */
  value: string;
  label: string;
  type: FieldType;
  /** Object owning the field. */
  objectCode: string;
  /** Single relations expand to the fields of their target object. */
  children?: ReferenceTreeNode[];
}

/** GET /api/meta/view-options/$objectCode (视图编辑器候选字段). */
export interface ViewEditorOptions {
  /** 二级分组：单选框类字段与单选关联字段。 */
  groupingCandidates: FieldDef[];
  /** 数据过滤可用字段（operators 为可选运算符）。 */
  filterCandidates: FieldDef[];
  /** 字段权限 / 字段配置：全部列表字段（含自定义字段）。 */
  columnCandidates: FieldDef[];
  /** 默认排序可用字段。 */
  sortCandidates: FieldDef[];
}

/** GET /api/meta/import-template/$objectCode column; import maps headers back by `name`. */
export interface ImportTemplateColumn {
  /** Field code; detail-section columns are "<sectionKey>.<fieldCode>". */
  code: string;
  name: string;
  required: boolean;
  tip: string | null;
  type: FieldType;
  /** Allowed labels of select fields. */
  options?: string[];
}

export interface ImportTemplate {
  objectCode: string;
  objectName: string;
  fileName: string;
  columns: ImportTemplateColumn[];
}

export interface OrgCompany {
  id: string;
  code: string;
  name: string;
}

export interface DeptNode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  /** Persons in this department and all sub-departments. */
  personCount: number;
  children: DeptNode[];
}

export interface PositionNode {
  id: string;
  code: string;
  name: string;
  count: number;
}

/** GET /api/system/org/tree. */
export interface OrgTree {
  company: OrgCompany;
  departments: DeptNode[];
  positions: PositionNode[];
}

export interface PersonLite {
  id: string;
  code: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  phone: string | null;
  userId: string | null;
  enabled: boolean;
}

/** GET /api/system/me. */
export interface MeResponse {
  user: {
    id: string;
    username: string;
    displayName: string;
    primaryRole: string;
    roles: string[];
    email?: string;
  };
  person: PersonLite;
  actions: string[];
}

/** GET /api/system/mobile-cards item. */
export interface MobileCardEntry extends MobileCardConfig {
  objectCode: string;
  /** 业务模块：工单 / 任务 / 报工 / 报工卡片。 */
  moduleName: string;
  /** 配置项：工单列表 / 任务列表 / 报工列表 / 详情字段。 */
  itemName: string;
  description: string;
}

/** GET /api/system/notifications/summary. */
export interface NotificationSummary {
  unread: number;
  latest: NotificationItem[];
}

/** GET /api/system/business-configs item (业务功能配置). */
export interface BusinessConfigItem {
  key: string;
  moduleName: string;
  subModuleName: string;
  configName: string;
  valueType: "BOOLEAN" | "SELECT" | "TEXT" | "NUMBER";
  currentValue: string;
  currentValueName: string;
  options: SelectOption[];
  description: string | null;
  modifier: RefValue | null;
  updatedAt: string;
}

export type CodeRuleSegmentType = "FIXED" | "DATE" | "SERIAL" | "BIZ_FIELD";

/** One segment of an 编码配置 rule. */
export interface CodeRuleSegment {
  type: CodeRuleSegmentType;
  /** FIXED: constant; DATE: yy/yyyy/yyMM/yyyyMM/yyyyMMdd/yyMMdd; SERIAL: 自增长数字; BIZ_FIELD: business property key. */
  value: string;
  /** SERIAL 补位方式 / 补位符号 / 长度. */
  padMode?: "NONE" | "LEFT" | "RIGHT";
  padChar?: string;
  length?: number;
  /** 是否显示: hidden segments still split the serial sequence but are left out of the code. */
  visible: boolean;
}

export interface CodeRuleRecord {
  id: string;
  code: string;
  name: string;
  businessType: string;
  enabled: boolean;
  remark: string | null;
  initBySystem: boolean;
  segments: CodeRuleSegment[];
  /** e.g. "CGRKyyyyMMdd000001". */
  preview: string;
  creator: RefValue | null;
  createdAt: string;
  modifier: RefValue | null;
  updatedAt: string;
}

/** 提醒对象 of a custom event step. */
export interface EventReceiver {
  type: "CURRENT_USER" | "PERSON" | "DEPARTMENT" | "DYNAMIC" | "ALL";
  /** PERSON / DEPARTMENT id. */
  id?: string;
  name: string;
  /** DYNAMIC: person relation field of the trigger object, e.g. "salesman". */
  field?: string;
}

/** 推送内容设置 item of a custom event step. */
export interface EventContentItem {
  key: string;
  label: string;
  /** Template text with ${对象.字段} variables. */
  value: string;
}

/** 执行事件 step (customEventRuleEvent). */
export interface EventRuleStep {
  eventType: "MESSAGE_PUSH";
  eventObject: "WECHAT_MESSAGE_NOTICE";
  receivers: EventReceiver[];
  contentItems: EventContentItem[];
}
