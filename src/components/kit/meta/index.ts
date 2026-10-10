// 通用元数据页面组件（列表、表单、明细表、参照、视图、导入导出、打印、移动卡片）。说明见同目录 README.md。

// List page and its parts
export { MetaListPage, type MetaListPageProps } from "@/components/kit/meta/meta-list-page";
export { SearchPanel, SearchFieldControl, type SearchPanelProps, type SearchFieldControlProps } from "@/components/kit/meta/search-panel";
export { FieldConfigPopover, ColumnConfigList, type FieldConfigPopoverProps, type ColumnConfigListProps } from "@/components/kit/meta/field-config-popover";
export { SortPopover, SortConditionList, type SortPopoverProps, type SortConditionListProps } from "@/components/kit/meta/sort-popover";
export { RowHeightMenu, type RowHeightMenuProps } from "@/components/kit/meta/row-height-menu";
export { RowActions, type RowActionsProps } from "@/components/kit/meta/row-actions";
export { FieldValue, type FieldValueProps } from "@/components/kit/meta/field-value";
export type { RowAction, BatchAction, TopTab, MetaListApi, ListRow } from "@/components/kit/meta/types";

// Views
export { ViewTabs, type ViewTabsProps } from "@/components/kit/meta/view-tabs";
export { ViewListDrawer, type ViewListDrawerProps } from "@/components/kit/meta/view-list-drawer";
export { ViewEditorDrawer, type ViewEditorDrawerProps } from "@/components/kit/meta/view-editor-drawer";
export { FilterConditionList, FilterValueEditor, type FilterConditionListProps, type FilterValueEditorProps } from "@/components/kit/meta/filter-condition-list";
export { ViewIcon, type ViewIconProps } from "@/components/kit/meta/view-icon";
export { ViewScopeSelect, isEmptyViewScope, type ViewScopeSelectProps } from "@/components/kit/meta/view-scope-select";

// Forms
export {
  MetaForm,
  type MetaFormProps,
  type MetaFormHandle,
  type FieldChange,
  type FieldRenderContext,
  type SectionSlotContext,
} from "@/components/kit/meta/meta-form";
export { FieldControl, type FieldControlProps } from "@/components/kit/meta/field-control";
export {
  DetailTable,
  type DetailTableProps,
  type DetailPickerConfig,
  type DetailCellContext,
} from "@/components/kit/meta/detail-table";
export { FormDrawer, type FormDrawerProps, type FormContainerContext, type FormLayout } from "@/components/kit/meta/form-drawer";
export { FullscreenModal, type FullscreenModalProps } from "@/components/kit/meta/fullscreen-modal";

// Pickers
export { ReferencePicker, type ReferencePickerProps } from "@/components/kit/meta/reference-picker";
export { ReferenceSelect, type ReferenceSelectProps } from "@/components/kit/meta/reference-select";
export { ReferenceInput, PersonInput, type ReferenceInputProps, type PersonInputProps } from "@/components/kit/meta/reference-input";
export { PersonPicker, type PersonPickerProps } from "@/components/kit/meta/person-picker";

// Import / export / print
export { ImportDialog, type ImportDialogProps } from "@/components/kit/meta/import-dialog";
export { ExportDialog, type ExportDialogProps } from "@/components/kit/meta/export-dialog";
export { ExcelLogModal, type ExcelLogModalProps } from "@/components/kit/meta/excel-log-modal";
export { PrintDialog, PRINT_LIMIT, printLimitMessage, type PrintDialogProps } from "@/components/kit/meta/print-dialog";

// Mobile cards
export { MobileCard, type MobileCardProps } from "@/components/kit/meta/mobile-card";
export { MobileCardConfigDialog, type MobileCardConfigDialogProps } from "@/components/kit/meta/mobile-card-config-dialog";

// Session
export { SessionExpiredDialog } from "@/components/kit/meta/session-expired-dialog";
