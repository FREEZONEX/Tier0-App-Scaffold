"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown, CircleX, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckboxIndicator } from "@/components/kit/ui/checkbox";
import {
  CONTROL_PADDING_X,
  FLOATING_PANEL_CLASS,
  controlFrameClass,
  optionRowClass,
  type ControlSize,
  type ControlStatus,
  type ControlVariant,
} from "@/components/kit/ui/control-styles";
import {
  useControllableState,
  useFloatingPosition,
  useIsoLayoutEffect,
  useLayerDismiss,
  type Placement,
} from "@/components/kit/ui/floating";
import { Empty } from "@/components/kit/ui/feedback";
import { FloatingLayer } from "@/components/kit/ui/layer";
import { ColorDotLabel } from "@/components/kit/ui/tag";
import { Tooltip } from "@/components/kit/ui/tooltip";
import type { OptionItem } from "@/components/kit/ui/types";

type Primitive = string | number;

interface SelectBaseProps<V extends Primitive> {
  options: OptionItem<V>[];
  /** Default 「请选择」. */
  placeholder?: string;
  size?: ControlSize;
  status?: ControlStatus;
  variant?: ControlVariant;
  disabled?: boolean;
  /** × button on hover while a value is selected. */
  allowClear?: boolean;
  /** Type to filter (default: false for single, true for multiple). */
  showSearch?: boolean;
  /** Remote search: called on every keystroke; local filtering is skipped. */
  onSearch?: (keyword: string) => void;
  /** Local filter; false disables filtering, a function replaces the default "label contains". */
  filterOption?: boolean | ((keyword: string, option: OptionItem<V>) => boolean);
  loading?: boolean;
  /** Shown when no option matches (default 「暂无数据」). */
  notFoundContent?: ReactNode;
  /** Custom option row content. */
  optionRender?: (option: OptionItem<V>, state: { selected: boolean; active: boolean }) => ReactNode;
  /** Custom rendering of the selected value (single) / tag content (multiple). */
  labelRender?: (option: OptionItem<V>) => ReactNode;
  /** Labels for selected values that are not in `options` (remote search results). */
  selectedOptions?: OptionItem<V>[];
  /** Multiple mode: tags shown before collapsing to 「+N」 (default "responsive" = as many as fit). */
  maxTagCount?: number | "responsive";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** Dropdown at least as wide as the control (default true). */
  popupMatchWidth?: boolean;
  popupClassName?: string;
  /** Max list height in px (default 256). */
  listHeight?: number;
  /** Content under the options, e.g. 「＋ 创建」. */
  popupFooter?: ReactNode | ((api: { close: () => void }) => ReactNode);
  /** Fires when the option list is scrolled near the bottom (滚动加载). */
  onPopupScrollEnd?: () => void;
  prefix?: ReactNode;
  suffixIcon?: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface SingleSelectProps<V extends Primitive = Primitive> extends SelectBaseProps<V> {
  multiple?: false;
  value?: V | null;
  defaultValue?: V | null;
  onChange?: (value: V | null, option: OptionItem<V> | null) => void;
}

export interface MultipleSelectProps<V extends Primitive = Primitive> extends SelectBaseProps<V> {
  multiple: true;
  value?: V[] | null;
  defaultValue?: V[];
  onChange?: (value: V[], options: OptionItem<V>[]) => void;
}

export type SelectProps<V extends Primitive = Primitive> = SingleSelectProps<V> | MultipleSelectProps<V>;

function sameValue(a: Primitive, b: Primitive): boolean {
  return a === b || String(a) === String(b);
}

function optionSearchText(option: OptionItem<Primitive>): string {
  if (option.searchText) return option.searchText;
  if (typeof option.label === "string" || typeof option.label === "number") return String(option.label);
  return String(option.value);
}

function isFormField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function OptionLabel<V extends Primitive>({
  option,
  labelRender,
}: {
  option: OptionItem<V>;
  labelRender?: (option: OptionItem<V>) => ReactNode;
}) {
  if (labelRender) return <>{labelRender(option)}</>;
  if (option.color) return <ColorDotLabel color={option.color}>{option.label}</ColorDotLabel>;
  return <span className="block min-w-0 truncate">{option.label}</span>;
}

export function Select<V extends Primitive = Primitive>(props: SelectProps<V>) {
  const {
    options,
    placeholder = "请选择",
    size = "md",
    status,
    variant = "outlined",
    disabled = false,
    allowClear = false,
    onSearch,
    filterOption,
    loading = false,
    notFoundContent,
    optionRender,
    labelRender,
    selectedOptions,
    maxTagCount = "responsive",
    placement = "bottom-start",
    popupMatchWidth = true,
    popupClassName,
    listHeight = 256,
    popupFooter,
    onPopupScrollEnd,
    prefix,
    suffixIcon,
    className,
    id,
    "aria-label": ariaLabel,
    onFocus,
    onBlur,
  } = props;
  const multiple = props.multiple === true;
  const searchable = props.showSearch ?? multiple;

  const reactId = useId();
  const layerId = `${reactId}-layer`;
  const listId = `${reactId}-list`;
  const frameRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tagAreaRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const keyboardNavRef = useRef(false);

  const externalValues: V[] | undefined =
    props.value === undefined
      ? undefined
      : props.value === null
        ? []
        : Array.isArray(props.value)
          ? props.value
          : [props.value];
  const initialValues: V[] = props.multiple
    ? (props.defaultValue ?? [])
    : props.defaultValue === undefined || props.defaultValue === null
      ? []
      : [props.defaultValue];
  const [values, setValues] = useControllableState<V[]>(externalValues, initialValues);
  const [isOpen, setOpenState] = useControllableState(props.open, false, props.onOpenChange);
  const [keyword, setKeyword] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);
  const visible = isOpen && !disabled;

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text || filterOption === false || (onSearch && filterOption === undefined)) return options;
    if (typeof filterOption === "function") return options.filter((option) => filterOption(keyword, option));
    return options.filter((option) => optionSearchText(option).toLowerCase().includes(text));
  }, [options, keyword, filterOption, onSearch]);

  function findOption(value: V): OptionItem<V> {
    return (
      options.find((option) => sameValue(option.value, value)) ??
      selectedOptions?.find((option) => sameValue(option.value, value)) ?? {
        value,
        label: String(value),
      }
    );
  }

  const selectedList = values.map(findOption);
  const hasValue = values.length > 0;
  const valuesKey = values.map(String).join("");

  const position = useFloatingPosition({
    open: visible,
    anchorRef: frameRef,
    floatingRef,
    placement,
    offset: 4,
    sameWidth: popupMatchWidth ? "min" : false,
  });

  function setOpen(next: boolean) {
    if (next === isOpen) return;
    setOpenState(next);
    if (next) {
      const selectedIndex = filtered.findIndex((option) => values.some((value) => sameValue(value, option.value)));
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : filtered.findIndex((option) => !option.disabled));
      keyboardNavRef.current = true;
    } else if (keyword) {
      setKeyword("");
      onSearch?.("");
    }
  }

  useLayerDismiss({
    open: visible,
    layerId,
    anchorRef: frameRef,
    onDismiss: () => setOpen(false),
  });

  useEffect(() => {
    if (!visible || activeIndex < 0 || !keyboardNavRef.current) return;
    keyboardNavRef.current = false;
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [visible, activeIndex, listId]);

  useIsoLayoutEffect(() => {
    if (!multiple) return;
    if (typeof maxTagCount === "number") {
      setVisibleCount(maxTagCount);
      return;
    }
    const area = tagAreaRef.current;
    const measure = measureRef.current;
    if (!area || !measure) return;
    function recompute() {
      if (!area || !measure) return;
      const available = area.clientWidth - (searchable ? 28 : 4);
      const children = Array.from(measure.children) as HTMLElement[];
      const rest = children.pop();
      const restWidth = (rest?.offsetWidth ?? 36) + 4;
      let used = 0;
      let count = 0;
      for (let index = 0; index < children.length; index += 1) {
        const width = children[index].offsetWidth + 4;
        const needRest = index < children.length - 1 ? restWidth : 0;
        if (used + width + needRest > available) break;
        used += width;
        count += 1;
      }
      setVisibleCount(Math.max(count, Math.min(1, children.length)));
    }
    recompute();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(recompute);
    observer?.observe(area);
    return () => observer?.disconnect();
  }, [multiple, maxTagCount, valuesKey, searchable]);

  function commitValues(next: V[]) {
    setValues(next);
    if (props.multiple) {
      props.onChange?.(next, next.map(findOption));
    } else {
      const first = next[0];
      props.onChange?.(first === undefined ? null : first, first === undefined ? null : findOption(first));
    }
  }

  function toggleOption(option: OptionItem<V>) {
    if (option.disabled) return;
    if (multiple) {
      const exists = values.some((value) => sameValue(value, option.value));
      commitValues(exists ? values.filter((value) => !sameValue(value, option.value)) : [...values, option.value]);
      if (keyword) {
        setKeyword("");
        onSearch?.("");
      }
      inputRef.current?.focus();
    } else {
      commitValues([option.value]);
      setOpen(false);
    }
  }

  function removeValue(value: V) {
    commitValues(values.filter((item) => !sameValue(item, value)));
  }

  function moveActive(direction: 1 | -1) {
    if (filtered.length === 0) return;
    let next = activeIndex;
    for (let step = 0; step < filtered.length; step += 1) {
      next = (next + direction + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    keyboardNavRef.current = true;
    setActiveIndex(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!visible) setOpen(true);
        else moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!visible) setOpen(true);
        else moveActive(-1);
        break;
      case "Enter":
        event.preventDefault();
        if (!visible) setOpen(true);
        else if (activeIndex >= 0 && filtered[activeIndex]) toggleOption(filtered[activeIndex]);
        break;
      case " ":
        if (!searchable) {
          event.preventDefault();
          setOpen(!visible);
        }
        break;
      case "Backspace":
        if (multiple && !keyword && hasValue) removeValue(values[values.length - 1]);
        break;
      case "Tab":
        if (visible) setOpen(false);
        break;
      default:
        break;
    }
  }

  function handleFrameMouseDown(event: MouseEvent<HTMLDivElement>) {
    // The dropdown is portaled but still a React child: ignore its bubbled events.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (disabled) return;
    if (event.target instanceof Element && event.target.closest("[data-select-ignore]")) return;
    if (event.target !== inputRef.current) event.preventDefault();
    inputRef.current?.focus();
    if (!visible) setOpen(true);
    else if (!searchable) setOpen(false);
  }

  const showClear = allowClear && hasValue && !disabled;
  const close = () => {
    setOpenState(false);
    if (keyword) {
      setKeyword("");
      onSearch?.("");
    }
  };
  const hiddenLabels = selectedList.slice(Number.isFinite(visibleCount) ? visibleCount : selectedList.length);

  return (
    <div
      ref={frameRef}
      className={cn(
        controlFrameClass({ size, status, variant, disabled, active: visible, fixedHeight: true }),
        "group cursor-pointer gap-1",
        multiple ? "pl-1 pr-[11px]" : CONTROL_PADDING_X[size],
        disabled && "cursor-not-allowed",
        className,
      )}
      onMouseDown={handleFrameMouseDown}
    >
      {prefix ? (
        <span className="flex shrink-0 items-center pl-1 text-text-tertiary [&>svg]:size-3.5">{prefix}</span>
      ) : null}

      <span ref={tagAreaRef} className="relative flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {multiple ? (
          <>
            {selectedList.slice(0, visibleCount).map((option) => (
              <span
                key={String(option.value)}
                className="inline-flex h-6 min-w-0 max-w-[180px] shrink-0 items-center gap-1 rounded-sm bg-fill-active pl-2 pr-1 text-sm leading-6 text-foreground"
              >
                <span className="min-w-0 truncate">
                  <OptionLabel option={option} labelRender={labelRender} />
                </span>
                {!disabled ? (
                  <button
                    type="button"
                    data-select-ignore=""
                    tabIndex={-1}
                    aria-label="移除"
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:text-foreground"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeValue(option.value);
                    }}
                  >
                    <span aria-hidden="true" className="text-xs leading-none">✕</span>
                  </button>
                ) : null}
              </span>
            ))}
            {hiddenLabels.length > 0 ? (
              <span data-select-ignore="" className="inline-flex shrink-0">
                <Tooltip
                  title={hiddenLabels.map((option) => optionSearchText(option)).join("、")}
                  placement="top"
                >
                  <span className="inline-flex h-6 shrink-0 items-center rounded-sm bg-fill-active px-2 text-sm leading-6 text-text-secondary">
                    +{hiddenLabels.length}
                  </span>
                </Tooltip>
              </span>
            ) : null}
            <span
              className={cn(
                "relative inline-flex h-6 min-w-1 shrink-0 items-center",
                searchable ? "max-w-full" : "w-1",
              )}
            >
              <input
                ref={inputRef}
                id={id}
                data-bare-control=""
                role="combobox"
                aria-label={ariaLabel}
                aria-expanded={visible}
                aria-haspopup="listbox"
                aria-controls={listId}
                aria-activedescendant={visible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                disabled={disabled}
                readOnly={!searchable}
                value={keyword}
                className="absolute inset-0 m-0 w-full min-w-0 border-0 bg-transparent p-0 text-sm leading-6 outline-none disabled:cursor-not-allowed"
                onChange={(event) => {
                  setKeyword(event.target.value);
                  onSearch?.(event.target.value);
                  if (!visible) setOpen(true);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={(event) => {
                  if (!floatingRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
                  onBlur?.();
                }}
              />
              <span aria-hidden="true" className="invisible whitespace-pre pl-1 text-sm">
                {keyword || " "}
              </span>
            </span>
            {!hasValue && !keyword ? (
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center truncate text-text-placeholder">
                {placeholder}
              </span>
            ) : null}
            <span
              ref={measureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 flex whitespace-nowrap"
            >
              {selectedList.map((option) => (
                <span
                  key={String(option.value)}
                  className="inline-flex h-6 max-w-[180px] shrink-0 items-center gap-1 rounded-sm pl-2 pr-1 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <OptionLabel option={option} labelRender={labelRender} />
                  </span>
                  <span className="size-4 shrink-0" />
                </span>
              ))}
              <span className="inline-flex h-6 items-center px-2 text-sm">+{selectedList.length}</span>
            </span>
          </>
        ) : (
          <>
            {hasValue && !keyword ? (
              <span className={cn("min-w-0 flex-1 truncate", visible && searchable && "opacity-40")}>
                <OptionLabel option={selectedList[0]} labelRender={labelRender} />
              </span>
            ) : null}
            {!hasValue && !keyword ? (
              <span className="pointer-events-none min-w-0 flex-1 truncate text-text-placeholder">{placeholder}</span>
            ) : null}
            <input
              ref={inputRef}
              id={id}
              data-bare-control=""
              role="combobox"
              aria-label={ariaLabel}
              aria-expanded={visible}
              aria-haspopup="listbox"
              aria-controls={listId}
              aria-activedescendant={visible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              disabled={disabled}
              readOnly={!searchable}
              value={keyword}
              className={cn(
                "absolute inset-0 m-0 h-full w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none disabled:cursor-not-allowed",
                searchable ? "cursor-text" : "cursor-pointer caret-transparent opacity-0",
              )}
              onChange={(event) => {
                setKeyword(event.target.value);
                onSearch?.(event.target.value);
                if (!visible) setOpen(true);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              onBlur={(event) => {
                if (!floatingRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
                onBlur?.();
              }}
            />
          </>
        )}
      </span>

      <span className="relative flex size-4 shrink-0 items-center justify-center text-text-placeholder">
        {loading ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-brand border-r-transparent" />
        ) : (
          <>
            {suffixIcon ?? (visible && searchable ? (
              <Search className={cn("size-3.5 transition-opacity", showClear && "group-hover:opacity-0")} />
            ) : (
              <ChevronDown
                className={cn(
                  "size-3.5 transition-[transform,opacity] duration-200",
                  visible && "rotate-180",
                  showClear && "group-hover:opacity-0",
                )}
              />
            ))}
            {showClear ? (
              <button
                type="button"
                data-select-ignore=""
                tabIndex={-1}
                aria-label="清除"
                className="absolute inset-0 flex items-center justify-center bg-card text-text-placeholder opacity-0 transition-opacity hover:text-text-tertiary group-hover:opacity-100"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  commitValues([]);
                  if (keyword) {
                    setKeyword("");
                    onSearch?.("");
                  }
                }}
              >
                <CircleX className="size-3.5" />
              </button>
            ) : null}
          </>
        )}
      </span>

      <FloatingLayer
        open={visible}
        layerId={layerId}
        floatingRef={floatingRef}
        style={position.style}
        placement={position.placement}
        className={cn(FLOATING_PANEL_CLASS, "max-w-[min(480px,calc(100vw-16px))] p-1", popupClassName)}
        onMouseDown={(event) => {
          if (!isFormField(event.target)) event.preventDefault();
        }}
      >
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          data-bare-control=""
          aria-multiselectable={multiple || undefined}
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: listHeight }}
          onScroll={(event) => {
            const element = event.currentTarget;
            if (onPopupScrollEnd && element.scrollTop + element.clientHeight >= element.scrollHeight - 24) {
              onPopupScrollEnd();
            }
          }}
        >
          {filtered.length === 0 ? (
            loading ? (
              <div className="flex items-center justify-center gap-2 py-5 text-sm text-text-tertiary">
                <span className="size-3.5 animate-spin rounded-full border-2 border-brand border-r-transparent" />
                加载中…
              </div>
            ) : (
              (notFoundContent ?? <Empty size="sm" />)
            )
          ) : (
            filtered.map((option, index) => {
              const selected = values.some((value) => sameValue(value, option.value));
              const active = index === activeIndex;
              return (
                <div
                  key={String(option.value)}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  className={cn(
                    optionRowClass({ active, selected: selected && !multiple, disabled: option.disabled }),
                    "mb-px last:mb-0",
                    option.disabled && option.color && "opacity-45",
                  )}
                  onMouseMove={() => {
                    if (activeIndex !== index) setActiveIndex(index);
                  }}
                  onClick={() => toggleOption(option)}
                >
                  {multiple ? <CheckboxIndicator checked={selected} disabled={option.disabled} /> : null}
                  {option.icon ? (
                    <span className="flex shrink-0 items-center [&>svg]:size-4">{option.icon}</span>
                  ) : null}
                  {optionRender ? (
                    <div className="min-w-0 flex-1">{optionRender(option, { selected, active })}</div>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="min-w-0 truncate">
                        <OptionLabel option={option} />
                      </span>
                      {option.description ? (
                        <span className="min-w-0 shrink-0 truncate text-xs text-text-tertiary">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  )}
                  {!multiple && selected ? <Check className="size-4 shrink-0 text-brand" /> : null}
                </div>
              );
            })
          )}
          {loading && filtered.length > 0 ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-text-tertiary">
              <span className="size-3 animate-spin rounded-full border-2 border-brand border-r-transparent" />
              加载中…
            </div>
          ) : null}
        </div>
        {popupFooter ? (
          <div className="mt-1 border-t border-border-secondary px-1 pt-1">
            {typeof popupFooter === "function" ? popupFooter({ close }) : popupFooter}
          </div>
        ) : null}
      </FloatingLayer>
    </div>
  );
}
