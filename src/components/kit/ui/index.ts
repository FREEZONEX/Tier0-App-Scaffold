// 小工单 UI 基础组件（灵动 / Ant Design v5 风格）。说明见同目录 README.md。

// Inputs
export { Input, TextArea, type InputProps, type TextAreaProps } from "@/components/kit/ui/input";
export {
  NumberInput,
  NumberRangeInput,
  type NumberInputProps,
  type NumberRangeInputProps,
  type NumberRange,
} from "@/components/kit/ui/number-input";
export {
  Select,
  type SelectProps,
  type SingleSelectProps,
  type MultipleSelectProps,
} from "@/components/kit/ui/select";
export {
  DatePicker,
  DateRangePicker,
  type DatePickerProps,
  type DateRangePickerProps,
  type DateRangePreset,
  type DateRangeValue,
} from "@/components/kit/ui/date-picker";
export { CalendarPanel, TimeColumns, type CalendarPanelProps, type TimeColumnsProps } from "@/components/kit/ui/calendar";
export {
  Checkbox,
  CheckboxGroup,
  CheckboxIndicator,
  type CheckboxProps,
  type CheckboxGroupProps,
  type CheckboxIndicatorProps,
} from "@/components/kit/ui/checkbox";
export { RadioGroup, type RadioGroupProps } from "@/components/kit/ui/radio";
export { Switch, type SwitchProps } from "@/components/kit/ui/switch";
export { Segmented, type SegmentedProps } from "@/components/kit/ui/segmented";

// Display
export {
  Tag,
  StatusTag,
  ColorDotLabel,
  type TagProps,
  type StatusTagProps,
  type ColorDotLabelProps,
} from "@/components/kit/ui/tag";
export { Avatar, Badge, type AvatarProps, type BadgeProps } from "@/components/kit/ui/avatar";
export { HighlightText, type HighlightTextProps } from "@/components/kit/ui/text";
export { FieldTypeIcon, type FieldTypeIconProps } from "@/components/kit/ui/field-type-icon";
export {
  FIELD_ICONS,
  FIELD_ICON_LABELS,
  resolveFieldIconKind,
  type FieldIconKind,
} from "@/components/kit/ui/field-icons";
export {
  Empty,
  Spin,
  Skeleton,
  TableSkeleton,
  ProgressBar,
  ProgressRing,
  type EmptyProps,
  type SpinProps,
  type SkeletonProps,
  type TableSkeletonProps,
  type ProgressBarProps,
  type ProgressRingProps,
  type ProgressStatus,
} from "@/components/kit/ui/feedback";

// Floating layers & menus
export { Popover, type PopoverProps } from "@/components/kit/ui/popover";
export { DropdownMenu, type DropdownMenuProps } from "@/components/kit/ui/dropdown-menu";
export { Tooltip, EllipsisText, type TooltipProps, type EllipsisTextProps } from "@/components/kit/ui/tooltip";
export { FloatingLayer, type FloatingLayerProps } from "@/components/kit/ui/layer";

// Buttons
export {
  IconButton,
  TextButton,
  SplitButton,
  type IconButtonProps,
  type TextButtonProps,
  type SplitButtonProps,
} from "@/components/kit/ui/buttons";

// Navigation & structure
export {
  Tabs,
  CapsuleGroup,
  AnchorTabs,
  type TabsProps,
  type CapsuleGroupProps,
  type AnchorTabsProps,
} from "@/components/kit/ui/tabs";
export { Pagination, type PaginationProps } from "@/components/kit/ui/pagination";
export { DataGrid, type DataGridColumn, type DataGridProps, type DataGridSelection } from "@/components/kit/ui/data-grid";
export { CollapseSection, type CollapseSectionProps } from "@/components/kit/ui/collapse-section";
export { TreeList, type TreeListProps } from "@/components/kit/ui/tree-list";

// Files
export {
  ImageUpload,
  AttachmentUpload,
  ImageThumbs,
  type ImageUploadProps,
  type AttachmentUploadProps,
  type ImageThumbsProps,
} from "@/components/kit/ui/upload";
export { ImagePreview, FilePreview, type ImagePreviewProps, type FilePreviewProps } from "@/components/kit/ui/preview";

// Shared types & helpers
export type { OptionItem, MenuItem, TreeNode, TagTone, TabItem } from "@/components/kit/ui/types";
export {
  controlFrameClass,
  optionRowClass,
  BARE_INPUT_CLASS,
  FLOATING_PANEL_CLASS,
  CONTROL_HEIGHT,
  CONTROL_FIXED_HEIGHT,
  type ControlSize,
  type ControlStatus,
  type ControlVariant,
} from "@/components/kit/ui/control-styles";
export {
  useControllableState,
  useFloatingPosition,
  useLayerDismiss,
  useHoverIntent,
  useLayerPath,
  isInsideLayer,
  FLOATING_Z_INDEX,
  type Placement,
} from "@/components/kit/ui/floating";
export {
  formatDateValue,
  formatWall,
  parseDateValue,
  serializeWall,
  nowWall,
  instantToWall,
  wallToInstant,
  APP_UTC_OFFSET_MINUTES,
  type DatePrecision,
  type DateValueFormat,
  type WallTime,
} from "@/components/kit/ui/date-utils";
export { formatNumber, parseNumberText, roundTo, clampNumber, type NumberFormatOptions } from "@/components/kit/ui/number-utils";
export {
  formatFileSize,
  fileToValue,
  readFileAsDataUrl,
  isImageFile,
  isPdfFile,
  downloadFileValue,
  IMAGE_ACCEPT,
  type FileValue,
} from "@/components/kit/ui/file-utils";
