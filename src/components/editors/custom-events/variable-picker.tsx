"use client";

/**
 * 推送内容变量选择 (01 §10.2; 259_custom_event_var_picker.png): the「＋」 at the right of a
 * 推送内容 input opens a searchable list grouped by 生产工单 / 关联对象 / 系统 (/ 统计数据 for
 * 定时触发); picking inserts `${对象.字段}` at the caret.
 */
import { ChevronRight, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/kit/ui/buttons";
import { Input } from "@/components/kit/ui/input";
import { Popover } from "@/components/kit/ui/popover";
import { cn } from "@/lib/utils";
import type { EventVariableGroup } from "@/components/editors/custom-events/event-model";

export interface VariablePickerProps {
  groups: EventVariableGroup[];
  onPick: (value: string) => void;
  disabled?: boolean;
}

export function VariablePicker({ groups, onPick, disabled = false }: VariablePickerProps) {
  const [keyword, setKeyword] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(groups.slice(1).map((group) => group.key)));
  const text = keyword.trim().toLowerCase();

  return (
    <Popover
      placement="bottom-end"
      disabled={disabled}
      aria-label="插入变量"
      className="w-80 p-2"
      content={({ close }) => (
        <div className="flex flex-col gap-2">
          <Input prefix={<Search />} allowClear placeholder="搜索字段" value={keyword} onChange={setKeyword} aria-label="搜索字段" />
          <div className="max-h-72 overflow-y-auto" role="tree" aria-label="变量">
            {groups.map((group) => {
              const variables = text ? group.variables.filter((variable) => variable.label.toLowerCase().includes(text) || variable.value.toLowerCase().includes(text)) : group.variables;
              if (text && variables.length === 0) return null;
              const open = Boolean(text) || !collapsed.has(group.key);
              return (
                <div key={group.key} role="treeitem" aria-expanded={open}>
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    className="justify-start gap-1 px-1 font-medium text-foreground"
                    icon={<ChevronRight className={cn("transition-transform", open && "rotate-90")} />}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                  >
                    {group.label}
                  </Button>
                  {open ? (
                    <ul role="group">
                      {variables.map((variable) => (
                        <li key={variable.value}>
                          <Button
                            variant="ghost"
                            size="sm"
                            block
                            className="justify-start pl-7 font-normal text-text-secondary hover:text-brand"
                            onClick={() => {
                              onPick(variable.value);
                              close();
                            }}
                          >
                            <span className="min-w-0 truncate">{variable.value}</span>
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
      )}
    >
      <IconButton size="sm" label="插入变量" icon={<Plus />} disabled={disabled} />
    </Popover>
  );
}
