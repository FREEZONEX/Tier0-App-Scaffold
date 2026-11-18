import { type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { TextArea } from "@/components/kit/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shouldSubmitComposerKey } from "@/lib/text-reveal";

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  stopLabel?: string;
  className?: string;
}

/**
 * ChatComposer — ReUI ai-chat composer adapted to scaffold controls.
 * Enter sends, Shift+Enter inserts a newline, IME composition is ignored.
 * While streaming, the primary send control becomes an outline Stop.
 * The field sits in one bordered well; focus ring is on the well, not the textarea.
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming = false,
  disabled = false,
  placeholder = "输入问题，Enter 发送",
  submitLabel = "发送",
  stopLabel = "停止",
  className,
}: ChatComposerProps) {
  const canSend = !disabled && !streaming && value.trim().length > 0;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const next = value.trim();
    if (!next || streaming || disabled) return;
    onSubmit(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldSubmitComposerKey(event)) return;
    event.preventDefault();
    submit();
  };

  return (
    <form
      data-slot="chat-composer"
      className={cn("shrink-0 bg-card px-3 pb-3 pt-1", className)}
      onSubmit={submit}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-[4px] border border-border bg-background p-2",
          "transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
          "focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/60",
        )}
      >
        <TextArea
          aria-label="问题"
          value={value}
          onChange={(next) => onChange(next)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled || streaming}
          autoSize={{ minRows: 1, maxRows: 6 }}
          resize="none"
          rows={1}
          maxLength={2000}
          showCount={false}
          variant="borderless"
          className="min-h-[var(--tier0-control-height-md)] border-0 bg-transparent px-1.5 py-1.5 shadow-none hover:bg-transparent focus-within:ring-0"
          wrapperClassName="min-w-0 flex-1"
        />
        {streaming ? (
          <Button
            type="button"
            variant="outline"
            size="md"
            aria-label={stopLabel}
            title={stopLabel}
            className="w-[var(--tier0-control-height-md)] shrink-0 px-0"
            onClick={onStop}
          >
            <Square className="size-3.5 fill-current" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="md"
            aria-label={submitLabel}
            title={submitLabel}
            disabled={!canSend}
            className="w-[var(--tier0-control-height-md)] shrink-0 px-0"
          >
            <ArrowUp aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

export interface ChatPromptChipsProps {
  items: { id: string; label: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Suggestion pills above the composer well. Outline, not TextButtons. */
export function ChatPromptChips({
  items,
  onSelect,
  disabled,
  className,
}: ChatPromptChipsProps) {
  if (!items.length) return null;
  return (
    <ul
      data-slot="chat-prompt-chips"
      className={cn("flex flex-wrap gap-1.5 px-3 pb-2", className)}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-7 px-2.5 text-xs font-normal"
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </Button>
        </li>
      ))}
    </ul>
  );
}
