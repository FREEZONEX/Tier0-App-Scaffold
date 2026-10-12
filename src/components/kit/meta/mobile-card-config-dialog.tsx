"use client";

import { useKitApi } from "@/components/kit/provider";


/** Configure generic record cards using application-supplied fields and options. */
import { GripVertical, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { FieldLabel } from "@/components/forms/field-label";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/kit/ui/buttons";
import { Checkbox } from "@/components/kit/ui/checkbox";
import { Input } from "@/components/kit/ui/input";
import { Select } from "@/components/kit/ui/select";
import { Tabs } from "@/components/kit/ui/tabs";
import { errorMessage } from "@/lib/component-kit/api-client";
import { useRequest } from "@/lib/hooks";
import { moveItem } from "@/lib/component-kit/list-columns";
import type { FieldDef, MobileCardEntry, MobileCardKey } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { MobileCard } from "@/components/kit/meta/mobile-card";

export interface MobileCardConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardKey: MobileCardKey;
  onSaved?: (entry: MobileCardEntry) => void;
}

export interface CardOptions {
  detailOnly?: boolean;
  statusFields?: string[];
  key: MobileCardKey;
  objectCode: string;
  fields: FieldDef[];
  components: { key: string; label: string }[];
  lockedFields: string[];
}

type ListTab = "fields" | "components";

function ConfigForm({
  entry,
  options,
  onCancel,
  onSaved,
}: {
  entry: MobileCardEntry;
  options: CardOptions;
  onCancel: () => void;
  onSaved: (entry: MobileCardEntry) => void;
}) {
  const api = useKitApi();
  const isDetail = options.detailOnly === true;
  const [titleFields, setTitleFields] = useState<string[]>(entry.titleFields);
  const [indicatorField, setIndicatorField] = useState<string | null>(entry.indicatorField);
  const [displayFields, setDisplayFields] = useState<string[]>(() => {
    const locked = options.lockedFields.filter((code) => !entry.displayFields.includes(code));
    return [...locked, ...entry.displayFields];
  });
  const [components, setComponents] = useState<string[]>(entry.components);
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<ListTab>("fields");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; indicator?: string; display?: string }>({});

  const byCode = useMemo(() => new Map(options.fields.map((field) => [field.code, field])), [options.fields]);
  const locked = useMemo(() => new Set(options.lockedFields), [options.lockedFields]);
  const numberFields = options.fields.filter((field) => field.type === "NUMBER" || field.widget?.fieldType === "NUMBER");
  const titleCandidates = options.fields.filter((field) => field.type !== "IMAGE" && field.type !== "ATTACHMENT");
  const needle = keyword.trim().toLowerCase();
  const filteredFields = options.fields.filter((field) => !needle || field.name.toLowerCase().includes(needle));
  const filteredComponents = options.components.filter((component) => !needle || component.label.toLowerCase().includes(needle));
  const tabLabel = entry.moduleName.replace(/卡片$/, "");

  const allFieldsChecked = filteredFields.length > 0 && filteredFields.every((field) => displayFields.includes(field.code));
  const someFieldsChecked = filteredFields.some((field) => displayFields.includes(field.code));
  const allComponentsChecked = filteredComponents.length > 0 && filteredComponents.every((component) => components.includes(component.key));
  const everything = allFieldsChecked && (options.components.length === 0 || allComponentsChecked);
  const anything = someFieldsChecked || components.length > 0;

  const toggleField = (code: string, checked: boolean) => {
    if (locked.has(code)) return;
    setDisplayFields((current) => (checked ? [...current, code] : current.filter((item) => item !== code)));
  };

  const setAllFields = (checked: boolean) => {
    setDisplayFields((current) => {
      if (checked) return [...current, ...filteredFields.map((field) => field.code).filter((code) => !current.includes(code))];
      const removing = new Set(filteredFields.map((field) => field.code).filter((code) => !locked.has(code)));
      return current.filter((code) => !removing.has(code));
    });
  };

  const setAllComponents = (checked: boolean) => {
    setComponents(checked ? options.components.map((component) => component.key) : []);
  };

  const selectedItems = [
    ...displayFields.map((code) => ({ kind: "field" as const, key: code, label: byCode.get(code)?.name ?? code })),
    ...components.map((key) => ({ kind: "component" as const, key, label: options.components.find((item) => item.key === key)?.label ?? key })),
  ];

  const save = async () => {
    const nextErrors: typeof errors = {};
    if (!isDetail && titleFields.length === 0) nextErrors.title = "请选择标题";
    if (!isDetail && !indicatorField) nextErrors.indicator = "请选择指标";
    if (displayFields.length === 0 && components.length === 0) nextErrors.display = "请选择展示字段";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const saved = await api.sendJson<MobileCardEntry>(apiUrl(`/api/system/mobile-cards/${entry.key}`), {
        method: "PUT",
        body: { key: entry.key, titleFields, indicatorField, displayFields, components },
      });
      toast.success(`「${entry.moduleName}·${entry.itemName}」卡片配置已保存`);
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error, "保存卡片配置失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!isDetail ? (
            <>
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                <FieldLabel required className="pt-1 sm:w-20 sm:justify-end">
                  标题
                </FieldLabel>
                <div className="min-w-0 flex-1">
                  <Select<string>
                    aria-label="标题"
                    multiple
                    status={errors.title ? "error" : undefined}
                    value={titleFields}
                    options={titleCandidates.map((field) => ({ value: field.code, label: field.name }))}
                    onChange={(next) => {
                      setTitleFields(next.slice(0, 3));
                      if (next.length > 3) toast.warning("标题最多选择 3 个字段");
                    }}
                  />
                  {errors.title ? <p className="mt-1 text-xs text-danger">{errors.title}</p> : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                <FieldLabel required className="pt-1 sm:w-20 sm:justify-end">
                  指标
                </FieldLabel>
                <div className="min-w-0 flex-1">
                  <Select<string>
                    aria-label="指标"
                    status={errors.indicator ? "error" : undefined}
                    value={indicatorField}
                    options={numberFields.map((field) => ({ value: field.code, label: field.name }))}
                    onChange={(next) => setIndicatorField(next)}
                  />
                  {errors.indicator ? <p className="mt-1 text-xs text-danger">{errors.indicator}</p> : null}
                </div>
              </div>
            </>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
            <FieldLabel required className="pt-1 sm:w-20 sm:justify-end">
              展示字段
            </FieldLabel>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-md border sm:flex-row",
                  errors.display ? "border-danger" : "border-border-strong",
                )}
              >
                <div className="flex min-w-0 flex-col border-b border-border-secondary sm:w-1/2 sm:border-r sm:border-b-0">
                  <div className="p-2">
                    <Input aria-label="搜索字段" allowClear prefix={<Search />} placeholder="请输入" value={keyword} onChange={(next) => setKeyword(next)} />
                  </div>
                  {/* 只有一个页签时列表里已有「全选」，这里不再重复。 */}
                  {options.components.length ? (
                    <div className="border-y border-border-secondary bg-[#fafbfc] px-3 py-2">
                      <Checkbox
                        checked={everything}
                        indeterminate={anything && !everything}
                        onChange={(checked) => {
                          setAllFields(checked);
                          setAllComponents(checked);
                        }}
                      >
                        全选
                      </Checkbox>
                    </div>
                  ) : null}
                  {options.components.length ? (
                    <Tabs<ListTab>
                      size="sm"
                      className="px-3"
                      activeKey={tab}
                      onChange={setTab}
                      items={[
                        { key: "fields", label: tabLabel },
                        { key: "components", label: "可视化组件" },
                      ]}
                    />
                  ) : null}
                  <div className="h-72 overflow-y-auto px-3 py-2">
                    {tab === "fields" || options.components.length === 0 ? (
                      <ul className="grid gap-1.5">
                        <li>
                          <Checkbox checked={allFieldsChecked} indeterminate={someFieldsChecked && !allFieldsChecked} onChange={setAllFields}>
                            全选
                          </Checkbox>
                        </li>
                        {filteredFields.map((field) => (
                          <li key={field.code}>
                            <Checkbox
                              checked={displayFields.includes(field.code)}
                              disabled={locked.has(field.code)}
                              onChange={(checked) => toggleField(field.code, checked)}
                            >
                              {field.name}
                            </Checkbox>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="grid gap-1.5">
                        {filteredComponents.length ? (
                          <>
                            <li>
                              <Checkbox checked={allComponentsChecked} onChange={setAllComponents}>
                                全选
                              </Checkbox>
                            </li>
                            {filteredComponents.map((component) => (
                              <li key={component.key}>
                                <Checkbox
                                  checked={components.includes(component.key)}
                                  onChange={(checked) =>
                                    setComponents((current) =>
                                      checked ? [...current, component.key] : current.filter((item) => item !== component.key),
                                    )
                                  }
                                >
                                  {component.label}
                                </Checkbox>
                              </li>
                            ))}
                          </>
                        ) : (
                          <li className="py-6 text-center text-xs text-text-tertiary">该卡片没有可视化组件</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col sm:w-1/2">
                  <div className="px-3 py-3 text-sm text-text-secondary">已选字段展示</div>
                  <ul className="grid max-h-[23.5rem] min-h-40 content-start gap-2 overflow-y-auto px-2 pb-2">
                    {selectedItems.map((item, index) => {
                      const fixed = item.kind === "field" && locked.has(item.key);
                      return (
                        <li
                          key={`${item.kind}:${item.key}`}
                          draggable={item.kind === "field" && !fixed}
                          onDragStart={(event) => {
                            setDragIndex(index);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", item.key);
                          }}
                          onDragOver={(event) => {
                            if (dragIndex !== null && item.kind === "field") event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (dragIndex === null || item.kind !== "field" || dragIndex >= displayFields.length) return;
                            // Locked fields (配置中标记为必需的字段) stay first.
                            const lockedCount = displayFields.filter((code) => locked.has(code)).length;
                            const target = Math.min(Math.max(index, lockedCount), displayFields.length - 1);
                            setDisplayFields((current) => moveItem(current, dragIndex, target));
                            setDragIndex(null);
                          }}
                          onDragEnd={() => setDragIndex(null)}
                          className={cn(
                            "flex min-w-0 items-center gap-2 rounded-md border border-dashed border-border-strong bg-card px-2 py-1.5 text-sm",
                            fixed && "bg-[#f5f5f5] text-text-tertiary",
                            dragIndex === index && "opacity-40",
                          )}
                        >
                          <GripVertical className={cn("size-3.5 shrink-0 text-text-placeholder", !fixed && item.kind === "field" && "cursor-grab")} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {!fixed ? (
                            <IconButton
                              size="sm"
                              label={`移除${item.label}`}
                              icon={<Trash2 />}
                              onClick={() =>
                                item.kind === "field"
                                  ? toggleField(item.key, false)
                                  : setComponents((current) => current.filter((key) => key !== item.key))
                              }
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              {errors.display ? <p className="mt-1 text-xs text-danger">{errors.display}</p> : null}
            </div>
          </div>
        </div>
        <aside className="flex min-w-0 flex-col gap-3 rounded-lg bg-[#f2f4f7] p-4 lg:w-80 lg:shrink-0">
          <span className="text-sm text-foreground">模板效果预览</span>
          <MobileCard
            config={{ titleFields, indicatorField, displayFields, components }}
            fields={options.fields}
            statusFields={options.statusFields ?? []}
          />
        </aside>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          确定
        </Button>
      </div>
    </div>
  );
}

function ConfigBody({ cardKey, onCancel, onSaved }: { cardKey: MobileCardKey; onCancel: () => void; onSaved: (entry: MobileCardEntry) => void }) {
  const api = useKitApi();
  const entry = useRequest(`mobile-card:${cardKey}`, (signal) =>
    api.getJson<MobileCardEntry>(apiUrl(`/api/system/mobile-cards/${cardKey}`), { signal }),
  );
  const options = useRequest(`mobile-card-options:${cardKey}`, (signal) =>
    api.getJson<CardOptions>(apiUrl(`/api/system/mobile-cards/${cardKey}/options`), { signal }),
  );
  return (
    <AsyncView result={entry} isEmpty={() => false}>
      {(card) => (
        <AsyncView result={options} isEmpty={() => false}>
          {(cardOptions) => <ConfigForm entry={card} options={cardOptions} onCancel={onCancel} onSaved={onSaved} />}
        </AsyncView>
      )}
    </AsyncView>
  );
}

export function MobileCardConfigDialog({ open, onOpenChange, cardKey, onSaved }: MobileCardConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="移动端卡片配置" size="xl">
      {open ? (
        <ConfigBody
          cardKey={cardKey}
          onCancel={() => onOpenChange(false)}
          onSaved={(entry) => {
            onSaved?.(entry);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
