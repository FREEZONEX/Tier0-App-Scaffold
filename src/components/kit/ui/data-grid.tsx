"use client";

/**
 * DataGrid — the table used by every list page, reference picker and detail
 * table (灵动 Ant-style table).
 *
 * - Columns: key, title, headerIcon, width, fixed left/right (sticky with
 *   computed offsets), align, render, ellipsis + hover tooltip (only when the
 *   text is actually truncated; one shared tooltip per grid).
 * - Leading columns: selection (checkbox / radio, header all/indeterminate)
 *   and 序号, both sticky left.
 * - Row height LOW/MID/HIGH, sticky header (with `maxHeight`), hover/selected
 *   rows, loading overlay, empty state, 合计 row, row click, row props
 *   (drag & drop reorder in DetailTable).
 * - Horizontal scrolling happens inside the grid (`overflow-x-auto`), so wide
 *   tables never widen the page on phones.
 * - Tree rows (`tree`): ▸/▾ on the indent column, children loaded lazily on
 *   expand and inserted under the parent (16px indent per level, recursive);
 *   `tree.resetKey` changes collapse everything.
 *
 * Selection keys are owned by the caller, so selections can span pages.
 */
import { Info, LoaderCircle } from "lucide-react";
import {
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { RequiredMark } from "@/components/forms/field-label";
import { EMPTY_TEXT, formatRefValue } from "@/lib/component-kit/format";
import type { RowHeight } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { CheckboxIndicator } from "@/components/kit/ui/checkbox";
import { Empty } from "@/components/kit/ui/feedback";
import { TOOLTIP_Z_INDEX, useFloatingPosition } from "@/components/kit/ui/floating";
import { FloatingLayer } from "@/components/kit/ui/layer";
import { Tooltip } from "@/components/kit/ui/tooltip";

export type DataGridAlign = "left" | "center" | "right";

export interface DataGridColumn<Row> {
  key: string;
  title: ReactNode;
  /** Small type icon before the title (灵动 header icons). */
  headerIcon?: ReactNode;
  /** Content after the title, e.g. a batch-fill trigger. */
  headerExtra?: ReactNode;
  /** ⓘ hint after the title (field widget tooltip). */
  headerTip?: string;
  /** Red required mark before the title (editable detail tables). */
  required?: boolean;
  /** Pixel width (default 150). */
  width?: number;
  fixed?: "left" | "right" | null;
  align?: DataGridAlign;
  /** Cell content; defaults to `row[key]` as text. */
  render?: (row: Row, index: number) => ReactNode;
  /** Tooltip text for rich cells (plain text cells use their own text). */
  tooltip?: (row: Row, index: number) => string | null | undefined;
  /** Truncate with tooltip (default true). Use false for inputs, tags and buttons. */
  ellipsis?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataGridSelection<Row> {
  mode: "multiple" | "single";
  selectedKeys: readonly string[];
  /** Next selected keys; `changed` lists the rows toggled by this interaction. */
  onChange: (keys: string[], changed: { rows: Row[]; checked: boolean }) => void;
  isRowSelectable?: (row: Row) => boolean;
  /** Hide the header checkbox (single mode never shows one). */
  hideSelectAll?: boolean;
}

export interface DataGridTree<Row> {
  /** Whether the row shows the ▸ expand toggle. */
  hasChildren: (row: Row) => boolean;
  /** Direct children, loaded on every expand (collapsing drops them). */
  loadChildren: (row: Row) => Promise<Row[]>;
  /** Column carrying the toggle and the indent (default: first data column). */
  indentColumn?: string;
  /** Changing it collapses every row (page / query / reload). */
  resetKey?: string | number;
  /** Loading children failed (the row collapses again). */
  onLoadError?: (error: unknown, row: Row) => void;
}

export interface DataGridProps<Row> {
  columns: readonly DataGridColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
  selection?: DataGridSelection<Row>;
  /** Show the 序号 column (default true). */
  showIndex?: boolean;
  /** Added to the 1-based row number (pagination). */
  indexOffset?: number;
  indexTitle?: ReactNode;
  indexWidth?: number;
  /** Custom 序号 cell (e.g. drag handle + number). */
  renderIndex?: (row: Row, index: number) => ReactNode;
  rowHeight?: RowHeight;
  loading?: boolean;
  /** Empty content (default: 暂无数据). */
  empty?: ReactNode;
  /** 合计 row values keyed by column key. */
  summary?: Partial<Record<string, ReactNode>> | null;
  summaryLabel?: ReactNode;
  /** Row click (ignored when the click starts on a button, link, input or label). */
  onRowClick?: (row: Row, index: number) => void;
  rowClassName?: (row: Row, index: number) => string | undefined;
  rowProps?: (row: Row, index: number) => HTMLAttributes<HTMLTableRowElement>;
  /** Scroll viewport max height (enables the sticky header). */
  maxHeight?: number | string;
  /**
   * List pages: grow the table down to the bottom of the scrolling page area,
   * keeping `bottomGap` px free (pagination), with the header sticky. Ignored
   * on phones (< 640px), where the page scrolls naturally.
   */
  fillViewport?: { bottomGap: number; minHeight?: number } | null;
  /** Tree list (父子工单): lazily expandable rows; child rows are selectable by `rowKey`. */
  tree?: DataGridTree<Row>;
  /** Keep selection / 序号 columns pinned left (default true). */
  stickyLeading?: boolean;
  /** Outer frame border + radius (default true). */
  bordered?: boolean;
  striped?: boolean;
  className?: string;
  tableClassName?: string;
  "aria-label"?: string;
}

const DEFAULT_WIDTH = 150;
const SELECTION_WIDTH = 48;
const DEFAULT_INDEX_WIDTH = 64;
const TIP_DELAY = 180;

const ROW_HEIGHT_CLASS: Record<RowHeight, string> = {
  LOW: "h-10",
  MID: "h-[52px]",
  HIGH: "h-[72px]",
};

const CELL_PADDING: Record<RowHeight, string> = {
  LOW: "px-3 py-1",
  MID: "px-3 py-2",
  HIGH: "px-3 py-3",
};

/** Vertical padding of the 勾选 cell (the global `td` padding would otherwise keep 12px). */
const SELECTION_PADDING: Record<RowHeight, string> = {
  LOW: "px-0 py-1",
  MID: "px-0 py-2",
  HIGH: "px-0 py-3",
};

/**
 * Phones (< 768px wide): when pinned columns would take more than this share of the table, the
 * user-fixed data columns scroll along (勾选 / 序号 / 操作 stay pinned). Desktop never unpins.
 */
const STICKY_BUDGET = 0.6;
const NARROW_SCREEN = 768;

/** Structural columns (操作 `__actions` …) are always pinned when fixed. */
function isStructuralColumn(column: { key: string }): boolean {
  return column.key.startsWith("__");
}
const TREE_INDENT = 16;
const TREE_PATH_SEPARATOR = "\u001f";

interface TreeNodeState<Row> {
  status: "loading" | "loaded";
  children: Row[];
}

interface TreeState<Row> {
  /** Identity of the `resetKey` period the nodes belong to. */
  epoch: object | null;
  nodes: Map<string, TreeNodeState<Row>>;
}

interface DisplayRow<Row> {
  row: Row;
  /** Selection key (`rowKey`). */
  key: string;
  /** Unique path of keys from the top row (React key, expand state). */
  path: string;
  depth: number;
  /** Index among its siblings (top rows: index in `rows`). */
  index: number;
}

const BORDER = "border-[var(--tier0-border-secondary)]";
const HEADER_BG = "bg-[var(--card)]";

interface LayoutCell<Row> {
  kind: "selection" | "index" | "data" | "filler";
  key: string;
  column?: DataGridColumn<Row>;
  width: number;
  sticky?: "left" | "right";
  offset: number;
  /** Last left-sticky / first right-sticky cell carries the scroll shadow. */
  edge?: "left" | "right";
}

function alignClass(align: DataGridAlign | undefined): string {
  if (align === "right") return "justify-end text-right";
  if (align === "center") return "justify-center text-center";
  return "justify-start text-left";
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, select, textarea, label, [role='button'], [role='checkbox'], [role='radio'], [role='combobox'], [data-grid-no-row-click]",
    ),
  );
}

function normalizeContent(content: unknown): ReactNode {
  if (content === null || content === undefined || content === "") return EMPTY_TEXT;
  if (typeof content === "string" || typeof content === "number") return content;
  if (typeof content === "boolean") return content ? "是" : "否";
  if (isValidElement(content)) return content;
  if (Array.isArray(content)) {
    if (content.length === 0) return EMPTY_TEXT;
    if (content.every((item) => isValidElement(item) || typeof item === "string" || typeof item === "number")) {
      return content as ReactNode;
    }
    return formatRefValue(content);
  }
  if (typeof content === "object") return formatRefValue(content);
  return String(content);
}

function SelectionControl({
  mode,
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onChange,
}: {
  mode: "checkbox" | "radio";
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      data-required-rendered="true"
      className={cn(
        "group relative inline-flex size-6 items-center justify-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type={mode}
        aria-label={label}
        aria-checked={indeterminate ? "mixed" : checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(mode === "radio" ? true : event.target.checked)}
        className="peer absolute inset-0 z-10 m-0 size-full cursor-[inherit] opacity-0"
      />
      {mode === "checkbox" ? (
        <CheckboxIndicator
          checked={checked}
          indeterminate={indeterminate && !checked}
          disabled={disabled}
          className={cn(
            "peer-focus-visible:shadow-[0_0_0_2px_rgb(5_145_255/0.25)]",
            !disabled && !checked && "group-hover:border-brand",
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex size-4 items-center justify-center rounded-full border bg-card transition-colors duration-150",
            checked ? "border-brand" : "border-border-strong group-hover:border-brand",
            disabled && "border-border-strong bg-input-disabled",
          )}
        >
          {checked ? <span className={cn("size-2 rounded-full", disabled ? "bg-text-placeholder" : "bg-brand")} /> : null}
        </span>
      )}
    </label>
  );
}

export function DataGrid<Row>({
  columns,
  rows,
  rowKey,
  selection,
  showIndex = true,
  indexOffset = 0,
  indexTitle = "序号",
  indexWidth = DEFAULT_INDEX_WIDTH,
  renderIndex,
  rowHeight = "MID",
  loading = false,
  empty,
  summary,
  summaryLabel = "合计",
  onRowClick,
  rowClassName,
  rowProps,
  maxHeight,
  fillViewport,
  tree,
  stickyLeading = true,
  bordered = true,
  striped = false,
  className,
  tableClassName,
  "aria-label": ariaLabel,
}: DataGridProps<Row>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [narrowScreen, setNarrowScreen] = useState(false);
  const [autoMaxHeight, setAutoMaxHeight] = useState<number | null>(null);
  const fillGap = fillViewport?.bottomGap;
  const fillMin = fillViewport?.minHeight ?? 240;

  useEffect(() => {
    const element = scrollRef.current;
    if (fillGap === undefined || !element || typeof window === "undefined") return;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (window.innerWidth < 640) {
          setAutoMaxHeight(null);
          return;
        }
        const scroller = element.closest(".page-y-scroll") as HTMLElement | null;
        const scrollerTop = scroller ? scroller.getBoundingClientRect().top : 0;
        const scrolled = scroller ? scroller.scrollTop : window.scrollY;
        const top = element.getBoundingClientRect().top - scrollerTop + scrolled;
        const viewport = scroller ? scroller.clientHeight : window.innerHeight;
        const next = Math.max(fillMin, Math.floor(viewport - top - fillGap));
        setAutoMaxHeight((previous) => (previous === next ? previous : next));
      });
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    let ancestor: HTMLElement | null = element.parentElement;
    for (let depth = 0; ancestor && depth < 4; depth += 1) {
      observer?.observe(ancestor);
      ancestor = ancestor.parentElement;
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [fillGap, fillMin]);

  /* ---------------- shared tooltip for truncated cells ---------------- */
  const tipLayerId = useId();
  const tipAnchorRef = useRef<HTMLElement | null>(null);
  const tipFloatingRef = useRef<HTMLDivElement | null>(null);
  const tipTimerRef = useRef<number | null>(null);
  const [tipText, setTipText] = useState<string | null>(null);
  const tipPosition = useFloatingPosition({
    open: tipText !== null,
    anchorRef: tipAnchorRef,
    floatingRef: tipFloatingRef,
    placement: "top",
    offset: 6,
    zIndex: TOOLTIP_Z_INDEX,
  });

  const clearTipTimer = () => {
    if (tipTimerRef.current !== null) {
      window.clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }
  };

  const hideTip = () => {
    clearTipTimer();
    tipAnchorRef.current = null;
    setTipText(null);
  };

  useEffect(() => () => clearTipTimer(), []);

  const handleCellHover = (event: MouseEvent<HTMLTableSectionElement>) => {
    const target = event.target instanceof Element ? (event.target.closest("[data-grid-tip]") as HTMLElement | null) : null;
    if (target === tipAnchorRef.current) return;
    hideTip();
    if (!target) return;
    const truncated = target.scrollWidth > target.clientWidth + 1 || target.scrollHeight > target.clientHeight + 1;
    const text = target.getAttribute("data-grid-tip") || target.textContent || "";
    if (!truncated || !text.trim() || text === EMPTY_TEXT) return;
    tipTimerRef.current = window.setTimeout(() => {
      tipAnchorRef.current = target;
      setTipText(text);
    }, TIP_DELAY);
  };

  /* ---------------- layout ---------------- */
  const layout = useMemo(() => {
    const cells: LayoutCell<Row>[] = [];
    if (selection) {
      cells.push({ kind: "selection", key: "__selection", width: SELECTION_WIDTH, offset: 0, sticky: stickyLeading ? "left" : undefined });
    }
    if (showIndex) {
      cells.push({ kind: "index", key: "__index", width: indexWidth, offset: 0, sticky: stickyLeading ? "left" : undefined });
    }
    const left = columns.filter((column) => column.fixed === "left");
    const middle = columns.filter((column) => column.fixed !== "left" && column.fixed !== "right");
    const right = columns.filter((column) => column.fixed === "right");
    const widthOf = (column: DataGridColumn<Row>) => column.width ?? DEFAULT_WIDTH;
    const pinnedWidth =
      cells.reduce((sum, cell) => sum + (cell.sticky ? cell.width : 0), 0) +
      [...left, ...right].reduce((sum, column) => sum + widthOf(column), 0);
    // Phones only: if everything pinned would leave no room to scroll, user-fixed data columns scroll along.
    const pinData = !narrowScreen || viewportWidth <= 0 || pinnedWidth <= viewportWidth * STICKY_BUDGET;
    const sideOf = (column: DataGridColumn<Row>, side: "left" | "right") =>
      pinData || isStructuralColumn(column) ? side : undefined;
    for (const column of left) {
      cells.push({ kind: "data", key: column.key, column, width: widthOf(column), offset: 0, sticky: sideOf(column, "left") });
    }
    const flexStart = cells.length;
    for (const column of middle) {
      cells.push({ kind: "data", key: column.key, column, width: widthOf(column), offset: 0 });
    }
    const flexEnd = cells.length;
    cells.push({ kind: "filler", key: "__filler", width: 0, offset: 0 });
    for (const column of right) {
      cells.push({ kind: "data", key: column.key, column, width: widthOf(column), offset: 0, sticky: sideOf(column, "right") });
    }

    // Columns narrower than the table share the free width by their widths (灵动 / antd), so the
    // table fills its container instead of ending in a blank filler column.
    const baseWidth = cells.reduce((sum, cell) => sum + cell.width, 0);
    const flexCells = cells.slice(flexStart, flexEnd).filter((cell) => cell.column && !isStructuralColumn(cell.column));
    const flexWidth = flexCells.reduce((sum, cell) => sum + cell.width, 0);
    const free = viewportWidth - baseWidth;
    if (free > 0 && flexWidth > 0) {
      let given = 0;
      flexCells.forEach((cell, index) => {
        const add = index === flexCells.length - 1 ? free - given : Math.floor((free * cell.width) / flexWidth);
        cell.width += add;
        given += add;
      });
    }

    let leftOffset = 0;
    let lastLeft = -1;
    cells.forEach((cell, index) => {
      if (cell.sticky === "left") {
        cell.offset = leftOffset;
        leftOffset += cell.width;
        lastLeft = index;
      }
    });
    let rightOffset = 0;
    let firstRight = -1;
    for (let index = cells.length - 1; index >= 0; index -= 1) {
      const cell = cells[index];
      if (cell.sticky === "right") {
        cell.offset = rightOffset;
        rightOffset += cell.width;
        firstRight = index;
      }
    }
    if (lastLeft >= 0) cells[lastLeft].edge = "left";
    if (firstRight >= 0) cells[firstRight].edge = "right";
    const totalWidth = cells.reduce((sum, cell) => sum + cell.width, 0);
    return { cells, totalWidth };
  }, [columns, indexWidth, narrowScreen, selection, showIndex, stickyLeading, viewportWidth]);

  const updateEdges = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const left = element.scrollLeft > 1;
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setEdges((previous) => (previous.left === left && previous.right === right ? previous : { left, right }));
    setViewportWidth((previous) => (previous === element.clientWidth ? previous : element.clientWidth));
    const narrow = typeof window !== "undefined" && window.innerWidth < NARROW_SCREEN;
    setNarrowScreen((previous) => (previous === narrow ? previous : narrow));
  }, []);

  useEffect(() => {
    updateEdges();
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateEdges());
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [updateEdges, layout.totalWidth, rows.length]);

  /* ---------------- tree rows ---------------- */
  const treeEnabled = Boolean(tree);
  const treeToken = tree ? String(tree.resetKey ?? "") : "";
  // A fresh object per resetKey value: A → B → A still starts collapsed.
  const treeEpoch = useMemo(() => ({ token: treeToken }), [treeToken]);
  const [treeState, setTreeState] = useState<TreeState<Row>>(() => ({ epoch: null, nodes: new Map() }));
  const treeNodes = useMemo(
    () => (treeEnabled && treeState.epoch === treeEpoch ? treeState.nodes : new Map<string, TreeNodeState<Row>>()),
    [treeEnabled, treeEpoch, treeState],
  );

  const displayRows = useMemo<DisplayRow<Row>[]>(() => {
    const list: DisplayRow<Row>[] = [];
    const walk = (items: readonly Row[], depth: number, parentPath: string) => {
      items.forEach((row, index) => {
        const key = rowKey(row, index);
        const path = depth === 0 ? key : `${parentPath}${TREE_PATH_SEPARATOR}${key}`;
        list.push({ row, key, path, depth, index });
        const node = treeNodes.get(path);
        if (node?.status === "loaded") walk(node.children, depth + 1, path);
      });
    };
    walk(rows, 0, "");
    return list;
  }, [rowKey, rows, treeNodes]);

  const toggleTreeRow = (entry: DisplayRow<Row>) => {
    if (!tree) return;
    const epoch = treeEpoch;
    const { path, row } = entry;
    const inside = (key: string) => key === path || key.startsWith(`${path}${TREE_PATH_SEPARATOR}`);
    const nodesOf = (current: TreeState<Row>) => new Map(current.epoch === epoch ? current.nodes : undefined);
    if (treeNodes.has(path)) {
      setTreeState((current) => {
        const next = nodesOf(current);
        for (const key of [...next.keys()]) if (inside(key)) next.delete(key);
        return { epoch, nodes: next };
      });
      return;
    }
    setTreeState((current) => {
      const next = nodesOf(current);
      next.set(path, { status: "loading", children: [] });
      return { epoch, nodes: next };
    });
    const { loadChildren, onLoadError } = tree;
    loadChildren(row).then(
      (children) =>
        setTreeState((current) => {
          if (current.epoch !== epoch || current.nodes.get(path)?.status !== "loading") return current;
          const next = new Map(current.nodes);
          next.set(path, { status: "loaded", children });
          return { epoch, nodes: next };
        }),
      (error: unknown) => {
        setTreeState((current) => {
          if (current.epoch !== epoch || !current.nodes.has(path)) return current;
          const next = new Map(current.nodes);
          for (const key of [...next.keys()]) if (inside(key)) next.delete(key);
          return { epoch, nodes: next };
        });
        onLoadError?.(error, row);
      },
    );
  };

  const indentKey = tree ? (tree.indentColumn ?? layout.cells.find((cell) => cell.kind === "data")?.key ?? null) : null;

  /* ---------------- selection ---------------- */
  const selectedSet = useMemo(() => new Set(selection?.selectedKeys ?? []), [selection?.selectedKeys]);
  const selectableIndexes = useMemo(
    () =>
      displayRows.flatMap((entry, index) =>
        !selection?.isRowSelectable || selection.isRowSelectable(entry.row) ? [index] : [],
      ),
    [displayRows, selection],
  );
  const selectedOnPage = selectableIndexes.filter((index) => selectedSet.has(displayRows[index].key)).length;
  const allSelected = selectableIndexes.length > 0 && selectedOnPage === selectableIndexes.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  const toggleAll = (checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selectedKeys);
    for (const index of selectableIndexes) {
      if (checked) next.add(displayRows[index].key);
      else next.delete(displayRows[index].key);
    }
    selection.onChange([...next], { rows: selectableIndexes.map((index) => displayRows[index].row), checked });
  };

  const toggleRow = (row: Row, key: string, checked: boolean) => {
    if (!selection) return;
    if (selection.mode === "single") {
      selection.onChange(checked ? [key] : [], { rows: [row], checked });
      return;
    }
    const next = new Set(selection.selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    selection.onChange([...next], { rows: [row], checked });
  };

  /* ---------------- rendering helpers ---------------- */
  const stickyStyle = (cell: LayoutCell<Row>): CSSProperties | undefined => {
    if (!cell.sticky) return undefined;
    return cell.sticky === "left" ? { left: cell.offset } : { right: cell.offset };
  };

  const edgeShadow = (cell: LayoutCell<Row>) =>
    cn(
      cell.edge === "left" &&
        edges.left &&
        "after:pointer-events-none after:absolute after:inset-y-0 after:-right-3 after:w-3 after:shadow-[inset_10px_0_8px_-8px_rgb(5_5_5/0.08)]",
      cell.edge === "right" &&
        edges.right &&
        "before:pointer-events-none before:absolute before:inset-y-0 before:-left-3 before:w-3 before:shadow-[inset_-10px_0_8px_-8px_rgb(5_5_5/0.08)]",
    );

  const colSpan = layout.cells.length;

  return (
    <div className={cn("relative min-w-0 max-w-full", bordered && `overflow-hidden rounded-lg border ${BORDER}`, className)}>
      <div
        ref={scrollRef}
        data-table-scroll="true"
        onScroll={() => {
          updateEdges();
          if (tipText !== null || tipTimerRef.current !== null) hideTip();
        }}
        className="overflow-x-auto overflow-y-auto overscroll-x-contain"
        style={autoMaxHeight !== null ? { maxHeight: autoMaxHeight } : maxHeight !== undefined ? { maxHeight } : undefined}
      >
        <table
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className={cn("table-fixed border-separate border-spacing-0 text-sm", tableClassName)}
          style={{ width: layout.totalWidth, minWidth: "100%" }}
        >
          <colgroup>
            {layout.cells.map((cell) => (
              <col key={cell.key} style={cell.kind === "filler" ? undefined : { width: cell.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {layout.cells.map((cell) => {
                const column = cell.column;
                return (
                  <th
                    key={cell.key}
                    scope="col"
                    style={stickyStyle(cell)}
                    className={cn(
                      "sticky top-0 z-[2] h-11 border-b px-3 py-2 text-left text-sm font-semibold leading-5 whitespace-nowrap text-foreground",
                      BORDER,
                      HEADER_BG,
                      cell.sticky && "z-[3]",
                      cell.kind === "selection" && "px-0 text-center",
                      cell.kind === "index" && "text-center",
                      cell.kind === "filler" && "px-0",
                      column?.headerClassName,
                      edgeShadow(cell),
                    )}
                  >
                    {cell.kind === "selection" && selection?.mode === "multiple" && !selection.hideSelectAll ? (
                      <span className="flex items-center justify-center">
                        <SelectionControl
                          mode="checkbox"
                          label="全选"
                          checked={allSelected}
                          indeterminate={someSelected}
                          disabled={selectableIndexes.length === 0}
                          onChange={toggleAll}
                        />
                      </span>
                    ) : null}
                    {cell.kind === "index" ? indexTitle : null}
                    {column ? (
                      <span className={cn("flex min-w-0 items-center gap-1.5", alignClass(column.align))}>
                        {column.headerIcon ? (
                          <span className="inline-flex shrink-0 text-muted-foreground [&>svg]:size-3.5" aria-hidden="true">
                            {column.headerIcon}
                          </span>
                        ) : null}
                        {column.required ? <RequiredMark className="-mr-1 shrink-0" /> : null}
                        <span className="truncate">{column.title}</span>
                        {column.headerTip ? (
                          <Tooltip title={column.headerTip}>
                            <span className="inline-flex shrink-0 items-center text-text-placeholder [&>svg]:size-3.5" aria-label={column.headerTip}>
                              <Info />
                            </span>
                          </Tooltip>
                        ) : null}
                        {column.headerExtra ? <span className="inline-flex shrink-0 items-center font-normal">{column.headerExtra}</span> : null}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody onMouseOver={handleCellHover} onMouseLeave={hideTip}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className={cn("border-b p-0", BORDER)}>
                  <div className="sticky left-0" style={viewportWidth ? { width: viewportWidth } : undefined}>
                    {loading ? <div className="h-32" /> : empty ?? <Empty className="py-8" />}
                  </div>
                </td>
              </tr>
            ) : (
              displayRows.map((entry, displayIndex) => {
                const { row, key, depth, index: rowIndex } = entry;
                const selected = selectedSet.has(key);
                const treeNode = tree ? treeNodes.get(entry.path) : undefined;
                const expandable = tree ? tree.hasChildren(row) : false;
                const selectable = !selection?.isRowSelectable || selection.isRowSelectable(row);
                const extraProps = rowProps?.(row, rowIndex) ?? {};
                const cellBg = selected
                  ? "bg-[var(--tier0-row-selected)]"
                  : striped && displayIndex % 2 === 1
                    ? "bg-[var(--card)] group-hover/row:bg-[var(--tier0-row-hover)]"
                    : "bg-card group-hover/row:bg-[var(--tier0-row-hover)]";
                const { onClick: extraClick, className: extraClassName, ...restProps } = extraProps;
                return (
                  <tr
                    key={entry.path}
                    {...restProps}
                    data-row-key={key}
                    data-tree-depth={tree ? depth : undefined}
                    aria-selected={selection ? selected : undefined}
                    onClick={(event: MouseEvent<HTMLTableRowElement>) => {
                      extraClick?.(event);
                      if (!onRowClick || isInteractiveTarget(event.target)) return;
                      onRowClick(row, rowIndex);
                    }}
                    className={cn("group/row", onRowClick && "cursor-pointer", rowClassName?.(row, rowIndex), extraClassName)}
                  >
                    {layout.cells.map((cell) => {
                      const base = cn(
                        "border-b align-middle text-foreground transition-colors duration-100",
                        BORDER,
                        ROW_HEIGHT_CLASS[rowHeight],
                        cellBg,
                        cell.sticky && "sticky z-[1]",
                        edgeShadow(cell),
                      );
                      if (cell.kind === "selection") {
                        return (
                          <td key={cell.key} style={stickyStyle(cell)} className={cn(base, SELECTION_PADDING[rowHeight], "text-center")}>
                            <span className="flex items-center justify-center">
                              <SelectionControl
                                mode={selection?.mode === "single" ? "radio" : "checkbox"}
                                label={selection?.mode === "single" ? "选择此行" : "勾选此行"}
                                checked={selected}
                                disabled={!selectable}
                                onChange={(checked) => toggleRow(row, key, checked)}
                              />
                            </span>
                          </td>
                        );
                      }
                      if (cell.kind === "index") {
                        return (
                          <td
                            key={cell.key}
                            style={stickyStyle(cell)}
                            className={cn(base, CELL_PADDING[rowHeight], "text-center tabular-nums text-muted-foreground")}
                          >
                            {depth > 0 ? null : renderIndex ? renderIndex(row, rowIndex) : indexOffset + rowIndex + 1}
                          </td>
                        );
                      }
                      if (cell.kind === "filler") {
                        return <td key={cell.key} className={cn(base, "p-0")} />;
                      }
                      const column = cell.column as DataGridColumn<Row>;
                      const raw = column.render ? column.render(row, rowIndex) : (row as Record<string, unknown>)[column.key];
                      const content = normalizeContent(raw);
                      const ellipsis = column.ellipsis !== false;
                      const tip = column.tooltip?.(row, rowIndex);
                      if (tree && cell.key === indentKey) {
                        const expanded = Boolean(treeNode);
                        return (
                          <td
                            key={cell.key}
                            style={stickyStyle(cell)}
                            className={cn(base, CELL_PADDING[rowHeight], "normal-nums", column.className)}
                          >
                            <div className="flex min-w-0 items-center gap-1" style={depth ? { paddingLeft: depth * TREE_INDENT } : undefined}>
                              {expandable ? (
                                <button
                                  type="button"
                                  aria-label={expanded ? "收起子级" : "展开子级"}
                                  aria-expanded={expanded}
                                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-fill-hover hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-border"
                                  onClick={() => toggleTreeRow(entry)}
                                >
                                  {treeNode?.status === "loading" ? (
                                    <LoaderCircle className="size-3.5 animate-spin text-brand" aria-hidden="true" />
                                  ) : (
                                    <svg
                                      viewBox="0 0 10 10"
                                      aria-hidden="true"
                                      className={cn("size-2.5 fill-current transition-transform duration-150", !expanded && "-rotate-90")}
                                    >
                                      <path d="M1 3h8L5 8z" />
                                    </svg>
                                  )}
                                </button>
                              ) : (
                                <span className="inline-block size-5 shrink-0" aria-hidden="true" />
                              )}
                              {ellipsis ? (
                                <div
                                  data-grid-tip={tip ?? ""}
                                  className={cn(
                                    "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
                                    column.align === "right" && "text-right",
                                    column.align === "center" && "text-center",
                                  )}
                                >
                                  {content}
                                </div>
                              ) : (
                                <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1", alignClass(column.align))}>{content}</div>
                              )}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={cell.key}
                          style={stickyStyle(cell)}
                          className={cn(base, CELL_PADDING[rowHeight], column.align === "right" ? "tabular-nums" : "normal-nums", column.className)}
                        >
                          {ellipsis ? (
                            <div
                              data-grid-tip={tip ?? ""}
                              className={cn(
                                "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
                                column.align === "right" && "text-right",
                                column.align === "center" && "text-center",
                              )}
                            >
                              {content}
                            </div>
                          ) : (
                            <div className={cn("flex min-w-0 flex-wrap items-center gap-1", alignClass(column.align))}>{content}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
            {summary && rows.length > 0 ? (
              <tr>
                {layout.cells.map((cell, cellIndex) => {
                  const base = cn(
                    "h-11 border-b px-3 py-2 text-sm font-semibold",
                    BORDER,
                    HEADER_BG,
                    cell.sticky && "sticky z-[1]",
                    edgeShadow(cell),
                  );
                  if (cell.kind !== "data") {
                    return (
                      <td
                        key={cell.key}
                        style={stickyStyle(cell)}
                        className={cn(base, "whitespace-nowrap text-center", cell.kind === "filler" && "p-0")}
                      >
                        {cellIndex === 0 ? summaryLabel : null}
                      </td>
                    );
                  }
                  const column = cell.column as DataGridColumn<Row>;
                  const value = summary[column.key];
                  return (
                    <td key={cell.key} style={stickyStyle(cell)} className={cn(base, column.align === "right" && "tabular-nums")}>
                      <div className={cn("flex min-w-0 items-center truncate", alignClass(column.align))}>
                        {cellIndex === 0 && value === undefined ? summaryLabel : value ?? null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {loading ? (
        <div className="absolute inset-0 z-[4] flex items-center justify-center bg-card/55" aria-live="polite">
          <span className="flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
            <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden="true" />
            加载中
          </span>
        </div>
      ) : null}
      <FloatingLayer
        open={tipText !== null}
        layerId={tipLayerId}
        floatingRef={tipFloatingRef}
        style={tipPosition.style}
        placement={tipPosition.placement}
        role="tooltip"
        animate={false}
        className="pointer-events-none max-w-[min(360px,calc(100vw-16px))] break-words rounded-md bg-[rgb(0_0_0/0.85)] px-2 py-1.5 text-xs leading-5 text-white shadow-popup"
      >
        {tipText}
      </FloatingLayer>
    </div>
  );
}
