"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecordSelectOption {
  value: string;
  label: string;
  description?: string;
  status?: string;
  quantity?: string | number;
  location?: string;
  date?: string;
  disabled?: boolean;
}

export interface RecordSelectMetaLabels {
  status?: string;
  quantity?: string;
  location?: string;
  date?: string;
}

export interface RecordSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: RecordSelectOption[];
  placeholder?: string;
  metaLabels?: RecordSelectMetaLabels;
}

const DEFAULT_META_LABELS: Required<RecordSelectMetaLabels> = {
  status: "status",
  quantity: "qty",
  location: "location",
  date: "date",
};

export function formatRecordOptionLabel(
  option: RecordSelectOption,
  metaLabels: RecordSelectMetaLabels = {},
) {
  const labels = { ...DEFAULT_META_LABELS, ...metaLabels };
  const meta = [
    option.description,
    option.status ? `${labels.status} ${option.status}` : undefined,
    option.quantity !== undefined
      ? `${labels.quantity} ${option.quantity}`
      : undefined,
    option.location ? `${labels.location} ${option.location}` : undefined,
    option.date ? `${labels.date} ${option.date}` : undefined,
  ].filter(Boolean);

  return meta.length > 0 ? `${option.label} - ${meta.join(" / ")}` : option.label;
}

/** Custom listbox; the visually hidden select preserves native form and change-event contracts. */
export function RecordSelect({
  options, placeholder = "Select record", metaLabels, className,
  id, disabled, multiple, value, defaultValue, onChange, onInvalid, ...props
}: RecordSelectProps) {
  const uid = useId();
  const listId = `${uid}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [validationMessage, setValidationMessage] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);
  const [localValue, setLocalValue] = useState(defaultValue ?? (multiple ? [] : placeholder ? "" : options.find(o => !o.disabled)?.value ?? ""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = value ?? localValue;
  const values = (Array.isArray(current) ? current : [current]).map(String);
  const items = placeholder && !multiple ? [{ value: "", label: placeholder }, ...options] : options;
  const selected = options.filter(option => values.includes(option.value));

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const upward = below < 180 && above > below;
      setPopupStyle({
        position: "fixed", zIndex: 1000,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.min(rect.width, window.innerWidth - 16),
        maxHeight: Math.max(40, Math.min(256, upward ? above : below)),
        ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    };
    position();
    const scroll = (event: Event) => { if (!popupRef.current?.contains(event.target as Node)) position(); };
    const observer = new ResizeObserver(position);
    if (triggerRef.current) observer.observe(triggerRef.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", scroll, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", scroll, true); };
  }, [open]);

  useEffect(() => {
    const form = selectRef.current?.form;
    const reset = () => { setLocalValue(defaultValue ?? (multiple ? [] : placeholder ? "" : options.find(o => !o.disabled)?.value ?? "")); setOpen(false); setValidationMessage(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, multiple, placeholder, options]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function choose(option: RecordSelectOption) {
    if (option.disabled || disabled) return;
    const next = multiple
      ? values.includes(option.value) ? values.filter(v => v !== option.value) : [...values, option.value]
      : [option.value];
    const element = selectRef.current;
    if (element) {
      for (const item of element.options) item.selected = next.includes(item.value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!multiple) setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative min-w-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <select {...props} ref={selectRef} disabled={disabled} multiple={multiple}
        value={current} tabIndex={-1} aria-hidden="true"
        style={{ position: "absolute", width: 1, height: 1, minHeight: 0, padding: 0, opacity: 0, pointerEvents: "none" }}
        onChange={event => {
          setValidationMessage("");
          setLocalValue(multiple ? Array.from(event.target.selectedOptions, option => option.value) : event.target.value);
          onChange?.(event);
        }}
        onInvalid={event => { onInvalid?.(event); if (!event.defaultPrevented) { event.preventDefault(); setValidationMessage(event.currentTarget.validationMessage); triggerRef.current?.focus(); } }}
      >
        {items.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{formatRecordOptionLabel(option, metaLabels)}</option>)}
      </select>
      <button ref={triggerRef} id={id} type="button" role="combobox" disabled={disabled}
        aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]}
        aria-describedby={[props["aria-describedby"], validationMessage ? `${uid}-error` : ""].filter(Boolean).join(" ") || undefined} aria-invalid={validationMessage ? true : props["aria-invalid"]}
        aria-required={props.required} aria-expanded={open && !disabled} aria-haspopup="listbox"
        aria-controls={listId} aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={cn("flex h-10 w-full min-w-0 items-center gap-2 rounded-sm border border-input bg-card px-3 text-left text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] duration-150 disabled:bg-surface-inset disabled:text-muted-foreground focus:border-highlight focus:ring-2 focus:ring-highlight/20", className)}
        onClick={() => { setActive(Math.max(0, items.findIndex(o => values.includes(o.value)))); setOpen(!open); }}
        onKeyDown={event => {
          if (event.key === "Escape") { if (open) event.stopPropagation(); setOpen(false); return; }
          if (event.key === "Tab") { setOpen(false); return; }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const enabled = items.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
            const offset = event.key === "ArrowUp" ? -1 : 1;
            const position = enabled.indexOf(open ? active : items.findIndex(o => values.includes(o.value)));
            const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1) : enabled[(position + offset + enabled.length) % enabled.length];
            setActive(next ?? 0); setOpen(true);
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault(); if (items[active]) choose(items[active]);
          } else if (event.key.length === 1 && event.key !== " ") {
            const index = items.findIndex(o => !o.disabled && o.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
            if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
          }
        }}>
        <span className="min-w-0 flex-1 truncate">{selected.length ? selected.map(o => formatRecordOptionLabel(o, metaLabels)).join(", ") : placeholder}</span>
        <ChevronDown aria-hidden="true" className={cn("pointer-events-none block size-4 shrink-0 self-center transition-transform", open && "rotate-180")} />
      </button>
      {validationMessage && <p id={`${uid}-error`} role="alert" className="mt-1 text-sm text-destructive">{validationMessage}</p>}
      {open && !disabled && createPortal(<div ref={popupRef} style={popupStyle} id={listId} role="listbox" aria-multiselectable={multiple || undefined}
        aria-label={props["aria-label"] ?? placeholder}
        className="min-w-0 overflow-y-auto rounded-md border border-input bg-card p-1 text-sm shadow-lg"
        onMouseDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => event.stopPropagation()}>
        {items.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option"
          aria-selected={values.includes(option.value)} aria-disabled={option.disabled || undefined}
          className={cn("flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-3 py-2", index === active && "bg-surface-inset", values.includes(option.value) && "bg-highlight/10", option.disabled && "cursor-not-allowed opacity-50")}
          onMouseMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(option)}>
          <span className="min-w-0 flex-1 break-words">{formatRecordOptionLabel(option, metaLabels)}</span>
          {values.includes(option.value) && <Check aria-hidden="true" className="size-4 shrink-0 text-highlight" />}
        </div>)}
      </div>, document.body)}
    </div>
  );
}
