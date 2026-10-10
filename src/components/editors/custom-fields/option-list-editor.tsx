"use client";

/**
 * 单选框 / 复选框「设置可选范围」:
 * 「＋ 新增可选项」「批量编辑」; each row = 颜色块 (preset colors) + 选项输入框 0/100 + 默认
 * (单选框 one default, click again to clear; 复选框 several) + 删除.
 * 批量编辑 dialog: one option per line, up to 100 options.
 */
import { Check, Info, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormDialog } from "@/components/overlays/form-dialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/kit/ui/buttons";
import { Checkbox } from "@/components/kit/ui/checkbox";
import { Input, TextArea } from "@/components/kit/ui/input";
import { Popover } from "@/components/kit/ui/popover";
import { RadioGroup } from "@/components/kit/ui/radio";
import { cn } from "@/lib/utils";
import { emptyOption, MAX_OPTIONS, OPTION_COLORS, OPTION_MAX_LENGTH, optionsFromLines, type OptionDraft } from "@/components/editors/custom-fields/field-type-meta";

export interface OptionListEditorProps {
  type: "SINGLE_SELECT" | "MULTI_SELECT";
  options: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
  error?: string;
}

function ColorSwatch({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  return (
    <Popover
      placement="bottom-start"
      aria-label="选项颜色"
      className="w-[196px] p-2"
      content={({ close }) => (
        <div className="grid grid-cols-7 gap-1.5">
          {OPTION_COLORS.map((item) => (
            <IconButton
              key={item}
              size="sm"
              label={item === color ? "当前颜色" : "选择此颜色"}
              tooltip={false}
              className="size-6 rounded-sm"
              style={{ backgroundColor: item }}
              icon={item === color ? <Check className="size-3.5 text-white" /> : <span />}
              onClick={() => {
                onChange(item);
                close();
              }}
            />
          ))}
        </div>
      )}
    >
      <IconButton
        variant="outline"
        label="选项颜色"
        tooltip={false}
        icon={<span className="block size-4 rounded-[3px]" style={{ backgroundColor: color }} />}
      />
    </Popover>
  );
}

export function OptionListEditor({ type, options, onChange, error }: OptionListEditorProps) {
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<OptionDraft>) => onChange(options.map((option) => (option.key === key ? { ...option, ...patch } : option)));

  const setDefault = (key: string, checked: boolean) => {
    if (type === "SINGLE_SELECT") onChange(options.map((option) => ({ ...option, isDefault: option.key === key ? checked : false })));
    else update(key, { isDefault: checked });
  };

  const submitBatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = optionsFromLines(batchText, options);
    if (result.error) {
      setBatchError(result.error);
      return;
    }
    let next = result.options;
    if (type === "SINGLE_SELECT") {
      let seen = false;
      next = next.map((option) => {
        const isDefault = option.isDefault && !seen;
        if (option.isDefault) seen = true;
        return { ...option, isDefault };
      });
    }
    onChange(next);
    setBatchOpen(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Plus />}
          disabled={options.length >= MAX_OPTIONS}
          onClick={() => onChange([...options, emptyOption(false)])}
        >
          新增可选项
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setBatchText(options.map((option) => option.label.trim()).filter(Boolean).join("\n"));
            setBatchError(null);
            setBatchOpen(true);
          }}
        >
          批量编辑
        </Button>
        <span className="text-xs text-text-tertiary tabular-nums">
          {options.length}/{MAX_OPTIONS}
        </span>
      </div>
      <ul className="flex min-w-0 flex-col gap-2">
        {options.map((option, index) => (
          <li key={option.key} className="flex min-w-0 items-center gap-2">
            <ColorSwatch color={option.color} onChange={(color) => update(option.key, { color })} />
            <Input
              aria-label={`选项${index + 1}`}
              className="min-w-0 flex-1"
              placeholder="请输入选项"
              maxLength={OPTION_MAX_LENGTH}
              showCount
              status={error && !option.label.trim() ? "error" : undefined}
              value={option.label}
              style={{ color: option.color }}
              onChange={(value) => update(option.key, { label: value })}
            />
            {type === "SINGLE_SELECT" ? (
              <span
                className="shrink-0"
                onClickCapture={(event) => {
                  if (option.isDefault) {
                    event.preventDefault();
                    setDefault(option.key, false);
                  }
                }}
              >
                <RadioGroup<string>
                  aria-label={`选项${index + 1}默认`}
                  options={[{ value: "default", label: "默认" }]}
                  value={option.isDefault ? "default" : null}
                  onChange={() => setDefault(option.key, true)}
                />
              </span>
            ) : (
              <Checkbox className="shrink-0" checked={option.isDefault} onChange={(checked) => setDefault(option.key, checked)}>
                默认
              </Checkbox>
            )}
            <IconButton
              label="删除选项"
              icon={<Trash2 />}
              disabled={options.length <= 1}
              className={cn(options.length > 1 && "hover:text-danger")}
              onClick={() => onChange(options.filter((item) => item.key !== option.key))}
            />
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <FormDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        title="批量编辑选项"
        submitLabel="确定"
        onSubmit={submitBatch}
      >
        <div className="flex items-start gap-2 rounded-md border border-[#b2ed1d] bg-[#e7f9b9] px-3 py-2 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          <span>每个选项单列一行，多个选项之间用回车符分隔，最多{MAX_OPTIONS}个选项。</span>
        </div>
        <TextArea
          aria-label="选项列表"
          rows={10}
          value={batchText}
          status={batchError ? "error" : undefined}
          onChange={(value) => {
            setBatchText(value);
            setBatchError(null);
          }}
        />
        {batchError ? (
          <p role="alert" className="text-sm text-danger">
            {batchError}
          </p>
        ) : null}
      </FormDialog>
    </div>
  );
}
