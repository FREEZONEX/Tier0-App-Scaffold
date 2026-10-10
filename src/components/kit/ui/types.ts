import type { ReactNode } from "react";

export type { ControlSize, ControlStatus, ControlVariant } from "@/components/kit/ui/control-styles";
export type { Placement } from "@/components/kit/ui/floating";

/** Option of Select / CheckboxGroup / RadioGroup / Segmented. */
export interface OptionItem<V extends string | number = string | number> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  /** CSS color: renders the option as a colored label (灵动 彩色选项). */
  color?: string | null;
  /** Secondary text under / after the label. */
  description?: ReactNode;
  /** Text used for local search when `label` is not a plain string. */
  searchText?: string;
  icon?: ReactNode;
}

/** Item of DropdownMenu / SplitButton menus. */
export interface MenuItem {
  key: string;
  label?: ReactNode;
  icon?: ReactNode;
  /** Red text (删除、取消…). */
  danger?: boolean;
  disabled?: boolean;
  /** Tooltip, e.g. why the item is disabled. */
  title?: string;
  /** "divider" renders a separator line; "group" renders a small caption. */
  type?: "item" | "divider" | "group";
  /** Right side content, e.g. an unread count. */
  extra?: ReactNode;
  onClick?: () => void;
}

/** Node of TreeList. */
export interface TreeNode<T = unknown> {
  key: string;
  title: ReactNode;
  /** Plain text for search / highlight when title is not a string. */
  searchText?: string;
  /** Shown as a muted number after the title (e.g. 部门人数). */
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
  /** false = clicking only expands (group rows). Default true. */
  selectable?: boolean;
  children?: TreeNode<T>[];
  data?: T;
}

/** Status tag tones (浅底深字). */
export type TagTone = "default" | "processing" | "success" | "warning" | "error";

/** Tab / capsule / anchor item. */
export interface TabItem<K extends string | number = string> {
  key: K;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Muted count after the label (CapsuleGroup: 「全部 45」). */
  count?: number;
  /** Optional pane content rendered by Tabs for the active key. */
  children?: ReactNode;
}
