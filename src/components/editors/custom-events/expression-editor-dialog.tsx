"use client";

/**
 * 条件表达式编辑器 (01 §10.3; 256_custom_event_expr_editor.png): title = condition name.
 * Left: 字段树 (对象字段含自定义字段, 关联对象, 系统, 定时触发的统计数据) with 「请输入字段名称查询」;
 * right top: code area with line numbers, placeholder「选择或输入字段，公式编辑支持空格和回车换行」,
 * counter 0/4000 and live 语法校验; right bottom: 常用符号 buttons / 常用函数 IN() NOT_IN() LIKE()
 * NOT_LIKE(). Clicking a field / symbol / function inserts it at the caret. 取消 / 确定.
 */
import { ChevronRight, CircleCheck, CircleX, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/kit/ui/input";
import { EXPRESSION_FUNCTIONS, EXPRESSION_MAX_LENGTH, EXPRESSION_SYMBOLS, positionOf } from "@/lib/component-kit/expression";
import { cn } from "@/lib/utils";
import { checkCondition, type EventVariableGroup } from "@/components/editors/custom-events/event-model";

export interface ExpressionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Condition name, e.g. 新增数据满足条件. */
  title: string;
  value: string;
  groups: EventVariableGroup[];
  known: Set<string>;
  withStatistics?: boolean;
  onConfirm: (value: string) => void;
}

function FieldTree({ groups, onPick }: { groups: EventVariableGroup[]; onPick: (value: string) => void }) {
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((group) => group.key)));
  const text = keyword.trim().toLowerCase();
  const visible = groups
    .map((group) => ({ ...group, variables: text ? group.variables.filter((variable) => variable.label.toLowerCase().includes(text) || variable.value.toLowerCase().includes(text)) : group.variables }))
    .filter((group) => !text || group.variables.length > 0);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Input prefix={<Search />} allowClear placeholder="请输入字段名称查询" value={keyword} onChange={setKeyword} aria-label="搜索字段" />
      <div className="min-h-0 flex-1 overflow-y-auto" role="tree" aria-label="字段">
        {visible.length === 0 ? <p className="px-2 py-6 text-center text-sm text-text-tertiary">无匹配字段</p> : null}
        {visible.map((group) => {
          const open = Boolean(text) || expanded.has(group.key);
          return (
            <div key={group.key} role="treeitem" aria-expanded={open}>
              <Button
                variant="ghost"
                size="sm"
                block
                className="justify-start gap-1 px-1 font-medium text-foreground"
                icon={<ChevronRight className={cn("transition-transform", open && "rotate-90")} />}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(group.key)) next.delete(group.key);
                    else next.add(group.key);
                    return next;
                  })
                }
              >
                <span className="min-w-0 truncate">{group.label}</span>
              </Button>
              {open ? (
                <ul role="group" className="pb-1">
                  {group.variables.map((variable) => (
                    <li key={variable.value}>
                      <Button
                        variant="ghost"
                        size="sm"
                        block
                        title={variable.value}
                        className="justify-start pl-7 text-text-secondary hover:text-brand"
                        onClick={() => onPick(variable.value)}
                      >
                        <span className="min-w-0 truncate">{variable.label}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PalettePanel({ onInsert }: { onInsert: (text: string, caret?: number) => void }) {
  const [section, setSection] = useState<"symbols" | "functions">("symbols");
  const [functionName, setFunctionName] = useState<string | null>(null);
  const shownFunctions = functionName ? EXPRESSION_FUNCTIONS.filter((item) => item.name === functionName) : EXPRESSION_FUNCTIONS;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border-secondary sm:flex-row">
      <nav className="flex shrink-0 flex-row flex-wrap gap-1 border-b border-border-secondary bg-[#fafbfc] p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r" aria-label="常用符号与函数">
        <Button variant={section === "symbols" ? "highlight" : "ghost"} size="sm" className="justify-start" onClick={() => setSection("symbols")}>
          常用符号
        </Button>
        <Button
          variant={section === "functions" && !functionName ? "highlight" : "ghost"}
          size="sm"
          className="justify-start"
          onClick={() => {
            setSection("functions");
            setFunctionName(null);
          }}
        >
          常用函数
        </Button>
        {EXPRESSION_FUNCTIONS.map((item) => (
          <Button
            key={item.name}
            variant={section === "functions" && functionName === item.name ? "highlight" : "ghost"}
            size="sm"
            className="justify-start sm:pl-6"
            onClick={() => {
              setSection("functions");
              setFunctionName(item.name);
            }}
          >
            {item.template}
          </Button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 p-3">
        <p className="mb-2 text-sm font-medium text-foreground">{section === "symbols" ? "常用符号" : "常用函数"}</p>
        {section === "symbols" ? (
          <div className="flex flex-wrap gap-2">
            {EXPRESSION_SYMBOLS.map((symbol) => (
              <Button
                key={symbol.text}
                variant="outline"
                className="h-14 w-[4.25rem] flex-col gap-0 px-1 leading-5"
                title={`插入「${symbol.text}」`}
                onClick={() => onInsert(symbol.insert ?? symbol.text)}
              >
                <span className="font-mono text-base">{symbol.text}</span>
                <span className="text-xs text-text-tertiary">{symbol.label}</span>
              </Button>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {shownFunctions.map((item) => (
              <li key={item.name} className="flex flex-col gap-1 rounded-md border border-border-secondary px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                <Button variant="outline" size="sm" className="font-mono" onClick={() => onInsert(item.template, item.template.length - 1)}>
                  {item.template}
                </Button>
                <span className="min-w-0 flex-1 text-sm text-text-secondary">
                  {item.description}
                  <span className="block truncate font-mono text-xs text-text-tertiary" title={item.example}>
                    例：{item.example}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EditorBody({
  title,
  initial,
  groups,
  known,
  withStatistics,
  onCancel,
  onConfirm,
}: {
  title: string;
  initial: string;
  groups: EventVariableGroup[];
  known: Set<string>;
  withStatistics: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [showError, setShowError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const problem = useMemo(() => checkCondition(text, known, withStatistics), [known, text, withStatistics]);
  const lineCount = Math.max(1, text.split("\n").length);

  const insert = (snippet: string, caret?: number) => {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${snippet}${text.slice(end)}`;
    if (next.length > EXPRESSION_MAX_LENGTH) return;
    setText(next);
    const position = start + (caret ?? snippet.length);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  };

  const locate = () => {
    if (!problem) return;
    const element = textareaRef.current;
    element?.focus();
    element?.setSelectionRange(problem.start, Math.max(problem.start + 1, problem.end));
  };

  const confirm = () => {
    if (problem) {
      setShowError(true);
      locate();
      return;
    }
    onConfirm(text.trim());
  };

  const where = problem ? positionOf(text, problem.start) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 md:h-[min(560px,calc(100dvh-220px))] md:flex-row">
        <aside className="flex max-h-72 min-h-0 shrink-0 flex-col rounded-md border border-border-secondary p-2 md:max-h-none md:w-56">
          <FieldTree groups={groups} onPick={(value) => insert(value)} />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex min-w-0 shrink-0 flex-col rounded-md border border-border-secondary">
            <div className="flex items-center justify-between gap-2 border-b border-border-secondary px-3 py-2">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{title} =</span>
              <span className={cn("shrink-0 text-xs tabular-nums", text.length > EXPRESSION_MAX_LENGTH ? "text-danger" : "text-text-tertiary")}>
                {text.length} / {EXPRESSION_MAX_LENGTH}
              </span>
            </div>
            <div className="flex h-48 min-w-0 md:h-56">
              <div ref={gutterRef} aria-hidden="true" className="w-10 shrink-0 overflow-hidden bg-[#fafbfc] py-2 text-right font-mono text-xs leading-6 text-text-placeholder">
                {Array.from({ length: lineCount }, (_, index) => (
                  <div key={index} className="pr-2">
                    {index + 1}
                  </div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                aria-label={`${title}表达式`}
                spellCheck={false}
                wrap="off"
                maxLength={EXPRESSION_MAX_LENGTH}
                placeholder="选择或输入字段，公式编辑支持空格和回车换行"
                className="min-w-0 max-w-full flex-1 resize-none overflow-auto border-0 bg-card px-3 py-2 font-mono text-sm leading-6 outline-none"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setShowError(false);
                }}
                onScroll={(event) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
              />
            </div>
            <div className="flex min-h-9 items-center gap-2 border-t border-border-secondary px-3 py-1.5 text-sm" role="status" aria-live="polite">
              {problem ? (
                <>
                  <CircleX className={cn("size-4 shrink-0", showError ? "text-danger" : "text-warning")} aria-hidden="true" />
                  <span className={cn("min-w-0 flex-1", showError ? "text-danger" : "text-text-secondary")}>{problem.message}</span>
                  {where ? (
                    <Button variant="link" size="sm" className="shrink-0" onClick={locate}>
                      定位
                    </Button>
                  ) : null}
                </>
              ) : text.trim() ? (
                <>
                  <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                  <span className="text-success">语法校验通过</span>
                </>
              ) : (
                <span className="text-text-tertiary">条件为空时不做判断，每次触发都执行</span>
              )}
            </div>
          </div>
          <PalettePanel onInsert={insert} />
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t border-border-secondary pt-3">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" onClick={confirm}>
          确定
        </Button>
      </div>
    </div>
  );
}

export function ExpressionEditorDialog({ open, onOpenChange, title, value, groups, known, withStatistics = false, onConfirm }: ExpressionEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="xl" closeOnOverlayClick={false}>
      {open ? (
        <EditorBody
          title={title}
          initial={value}
          groups={groups}
          known={known}
          withStatistics={withStatistics}
          onCancel={() => onOpenChange(false)}
          onConfirm={(next) => {
            onConfirm(next);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
