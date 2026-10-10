/**
 * Public types of the generic metadata page components (components/lingo/meta).
 * Kept in a .ts module so component files only export components.
 */
import type { ReactNode } from "react";
import type { ListRow } from "@/lib/component-kit/use-list-controller";
import type { QueryFilter } from "@/lib/component-kit/types";

export type { ListRow };

/** Row operation (操作列). The first `inlineActionCount` visible actions are inline, the rest go to ⋯. */
export interface RowAction {
  key: string;
  label: string;
  /** Red text (删除、取消…). */
  danger?: boolean;
  /** Text tone for inline actions (确认 = success). Danger wins. */
  tone?: "primary" | "success" | "warning" | "danger" | "default";
  /** Grayed out; `disabledReason` becomes the tooltip. */
  disabled?: boolean;
  disabledReason?: string;
  /** Not rendered at all. */
  hidden?: boolean;
  onClick: () => void;
}

/** Button of the 勾选批量 toolbar (「已选 N 项」 + actions + 撤销多选). */
export interface BatchAction {
  key: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  hidden?: boolean;
  icon?: ReactNode;
  onClick: () => void;
}

/** Top quick scopes above the list, e.g. 全部任务 / 我的任务 → QueryRequest.scope. */
export interface TopTab {
  key: string;
  label: string;
  /** QueryRequest.scope (omit for "all"). */
  scope?: string;
  /** Extra filters of this tab. */
  filters?: QueryFilter[];
}

/** Imperative handle exposed through `MetaListPage.onReady`. */
export interface MetaListApi {
  /** Re-run the current query (keeps page, filters and selection). */
  reload: () => void;
  /** Reload the page config (after custom field / view changes). */
  reloadConfig: () => void;
  clearSelection: () => void;
  getSelectedRows: () => ListRow[];
  /** Open 选择打印模板 for these rows (≤ 20). */
  openPrint: (rows: ListRow[]) => void;
  openImport: () => void;
  openExport: () => void;
}
