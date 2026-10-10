"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ReferenceSelect — 下拉搜索参照:
 * type to search, options「名称 | 编码」, single or multiple. Options load when
 * the dropdown opens and on every (debounced) keystroke from
 * GET /api/meta/reference-options/$objectCode?keyword=&limit=.
 */
import { useEffect, useRef, useState } from "react";
import type { ControlSize, ControlStatus, ControlVariant } from "@/components/kit/ui/control-styles";
import { Select } from "@/components/kit/ui/select";
import type { OptionItem } from "@/components/kit/ui/types";
import { errorMessage, isAbortError } from "@/lib/component-kit/api-client";
import { isRefValue, refOptionLabel } from "@/lib/component-kit/format";
import type { FieldDef, RefValue, ReferenceOption } from "@/lib/component-kit/types";
import {  } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";

export interface ReferenceSelectProps {
  field?: Pick<FieldDef, "reference" | "widget" | "name">;
  objectCode?: string;
  value: RefValue | RefValue[] | null;
  /** New value plus the picked option records (for fillRules; empty when cleared). */
  onChange: (value: RefValue | RefValue[] | null, records: Record<string, unknown>[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  status?: ControlStatus;
  size?: ControlSize;
  variant?: ControlVariant;
  /** Options per request (default 50). */
  limit?: number;
  /** Hide options for which this returns false. */
  filterOption?: (option: ReferenceOption) => boolean;
  className?: string;
  "aria-label"?: string;
}

function toRefList(value: ReferenceSelectProps["value"]): RefValue[] {
  if (Array.isArray(value)) return value.filter(isRefValue);
  return isRefValue(value) ? [value] : [];
}

export function ReferenceSelect({
  field,
  objectCode,
  value,
  onChange,
  multiple,
  placeholder,
  disabled = false,
  status,
  size = "md",
  variant = "outlined",
  limit = 50,
  filterOption,
  className,
  "aria-label": ariaLabel,
}: ReferenceSelectProps) {
  const api = useKitApi();
  const target = objectCode ?? field?.reference?.objectCode ?? "";
  const isMultiple = multiple ?? field?.widget?.selectionMode === "MULTIPLE";
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const load = (keyword: string) => {
    if (!target) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ keyword, limit: String(limit) });
    api.getJson<{ list: ReferenceOption[] }>(apiUrl(`/api/meta/reference-options/${target}`) + `?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setOptions(filterOption ? data.list.filter(filterOption) : data.list);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return;
        setLoadError(errorMessage(error, "加载选项失败"));
        setLoading(false);
      });
  };

  const scheduleLoad = (keyword: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => load(keyword.trim()), 250);
  };

  const selected = toRefList(value);
  const byId = new Map(options.map((option) => [option.id, option]));
  const optionItems: OptionItem<string>[] = options.map((option) => ({
    value: option.id,
    label: option.label || refOptionLabel(option),
    searchText: `${option.name} ${option.code ?? ""}`,
  }));
  const selectedOptions: OptionItem<string>[] = selected.map((ref) => ({ value: ref.id, label: refOptionLabel(ref) }));

  const toRef = (id: string): RefValue | null => {
    const option = byId.get(id);
    if (option) return { id: option.id, name: option.name, code: option.code };
    return selected.find((ref) => ref.id === id) ?? null;
  };

  const common = {
    "aria-label": ariaLabel,
    className,
    size,
    status,
    variant,
    disabled: disabled || !target,
    allowClear: true,
    showSearch: true,
    filterOption: false as const,
    loading,
    options: optionItems,
    selectedOptions,
    placeholder: placeholder ?? field?.widget?.placeholder ?? (field ? `请选择${field.name}` : "请选择"),
    notFoundContent: loadError ?? (loading ? "加载中…" : "暂无数据"),
    onSearch: scheduleLoad,
    onOpenChange: (open: boolean) => {
      if (open) load("");
    },
  };

  if (isMultiple) {
    return (
      <Select<string>
        {...common}
        multiple
        value={selected.map((ref) => ref.id)}
        onChange={(ids) => {
          const refs = ids.map(toRef).filter((ref): ref is RefValue => ref !== null);
          const records = ids.map((id) => byId.get(id)?.record).filter((record): record is Record<string, unknown> => Boolean(record));
          onChange(refs, records);
        }}
      />
    );
  }

  return (
    <Select<string>
      {...common}
      value={selected[0]?.id ?? null}
      onChange={(id) => {
        if (!id) {
          onChange(null, []);
          return;
        }
        const ref = toRef(id);
        const record = byId.get(id)?.record;
        onChange(ref, record ? [record] : []);
      }}
    />
  );
}
