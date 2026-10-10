"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * PersonPicker — 灵动「选择人员」 (122_prod_order_create_person_popup.png):
 * left 公司下拉 + 部门 / 岗位 页签树; middle 搜索 + 人员列表 (未选择时「请选择左侧」);
 * 穿梭按钮 > <; right「已选：N」+ 全选 + 已选列表; 取消 / 保存.
 * Single mode keeps at most one person. Double-click moves an item directly.
 *
 * Data: GET /api/system/org/tree, GET /api/system/org/persons?departmentId=&positionId=&keyword=.
 */
import { ChevronLeft, ChevronRight, Hand, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AsyncView } from "@/components/data/async-view";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/kit/ui/checkbox";
import { Empty } from "@/components/kit/ui/feedback";
import { Input } from "@/components/kit/ui/input";
import { Select } from "@/components/kit/ui/select";
import { Tabs } from "@/components/kit/ui/tabs";
import { TreeList } from "@/components/kit/ui/tree-list";
import type { TreeNode } from "@/components/kit/ui/types";

import { useRequest } from "@/lib/hooks";
import { isRefValue } from "@/lib/component-kit/format";
import type { DeptNode, OrgTree, PersonLite, RefValue } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";

export interface PersonPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Allow several persons (default false). */
  multiple?: boolean;
  /** Currently selected persons (回显). */
  value?: RefValue | RefValue[] | null;
  title?: string;
  /** Receives the chosen persons as RefValue snapshots. */
  onConfirm: (persons: RefValue[]) => void;
}

type OrgTab = "department" | "position";

function toRef(person: PersonLite): RefValue {
  return { id: person.id, name: person.name, code: person.code };
}

function initialSelection(value: PersonPickerProps["value"]): RefValue[] {
  if (Array.isArray(value)) return value.filter(isRefValue);
  return isRefValue(value) ? [value] : [];
}

function deptNodes(departments: DeptNode[]): TreeNode<DeptNode>[] {
  return departments.map((department) => ({
    key: department.id,
    title: department.name,
    searchText: department.name,
    count: department.personCount,
    data: department,
    children: department.children?.length ? deptNodes(department.children) : undefined,
  }));
}

function PersonRow({
  person,
  checked,
  multiple,
  onToggle,
  onActivate,
}: {
  person: RefValue & { detail?: string };
  checked: boolean;
  multiple: boolean;
  onToggle: (checked: boolean) => void;
  onActivate: () => void;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-fill-hover",
        checked && "bg-brand-soft hover:bg-brand-soft",
      )}
      onDoubleClick={onActivate}
    >
      {multiple ? (
        <Checkbox checked={checked} onChange={(next) => onToggle(next)} className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{person.name}</span>
            {person.detail ? <span className="truncate text-xs text-text-tertiary">{person.detail}</span> : null}
          </span>
        </Checkbox>
      ) : (
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm" data-required-rendered="true">
          <input
            type="radio"
            className="size-4 shrink-0 accent-[var(--color-brand,#050b14)]"
            checked={checked}
            onChange={() => onToggle(true)}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{person.name}</span>
            {person.detail ? <span className="truncate text-xs text-text-tertiary">{person.detail}</span> : null}
          </span>
        </label>
      )}
    </li>
  );
}

function PersonPickerBody({
  multiple,
  value,
  onCancel,
  onConfirm,
}: {
  multiple: boolean;
  value: PersonPickerProps["value"];
  onCancel: () => void;
  onConfirm: (persons: RefValue[]) => void;
}) {
  const api = useKitApi();
  const [tab, setTab] = useState<OrgTab>("department");
  const [nodeKey, setNodeKey] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<RefValue[]>(() => initialSelection(value));
  const [checkedCandidates, setCheckedCandidates] = useState<string[]>([]);
  const [checkedSelected, setCheckedSelected] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [keywordDraft]);

  const tree = useRequest("org-tree", (signal) => api.getJson<OrgTree>(apiUrl("/api/system/org/tree"), { signal }));

  const hasScope = Boolean(nodeKey) || Boolean(keyword);
  const personsKey = `org-persons:${tab}:${nodeKey ?? ""}:${keyword}`;
  const persons = useRequest(
    personsKey,
    (signal) => {
      const params = new URLSearchParams();
      if (nodeKey && tab === "department") params.set("departmentId", nodeKey);
      if (nodeKey && tab === "position") params.set("positionId", nodeKey);
      if (keyword) params.set("keyword", keyword);
      return api.getJson<{ list: PersonLite[] }>(apiUrl("/api/system/org/persons") + `?${params.toString()}`, { signal });
    },
    { enabled: hasScope },
  );

  const selectedIds = useMemo(() => new Set(selected.map((person) => person.id)), [selected]);

  const addPersons = (people: RefValue[]) => {
    if (people.length === 0) return;
    if (!multiple) {
      setSelected([people[0]]);
      setCheckedCandidates([]);
      return;
    }
    setSelected((current) => {
      const ids = new Set(current.map((person) => person.id));
      return [...current, ...people.filter((person) => !ids.has(person.id))];
    });
    setCheckedCandidates([]);
  };

  const removePersons = (ids: string[]) => {
    const removing = new Set(ids);
    setSelected((current) => current.filter((person) => !removing.has(person.id)));
    setCheckedSelected((current) => current.filter((id) => !removing.has(id)));
  };

  const candidateList = persons.data?.list ?? [];
  const moveRight = () => addPersons(candidateList.filter((person) => checkedCandidates.includes(person.id)).map(toRef));
  const allSelectedChecked = selected.length > 0 && checkedSelected.length === selected.length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-[#f0f3f8] p-3 sm:flex-row sm:items-stretch">
        {/* 左：公司 + 部门/岗位 */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 rounded-md bg-card p-3 sm:w-[30%]">
          <AsyncView result={tree} isEmpty={() => false}>
            {(org) => (
              <>
                <Select<string>
                  aria-label="公司"
                  value={org.company.id}
                  options={[{ value: org.company.id, label: org.company.name }]}
                  onChange={() => undefined}
                />
                <Tabs<OrgTab>
                  size="sm"
                  activeKey={tab}
                  onChange={(next) => {
                    setTab(next);
                    setNodeKey(null);
                    setCheckedCandidates([]);
                  }}
                  items={[
                    { key: "department", label: "部门" },
                    { key: "position", label: "岗位" },
                  ]}
                />
                <TreeList<unknown>
                  aria-label={tab === "department" ? "部门" : "岗位"}
                  height="min(46vh, 360px)"
                  defaultExpandAll
                  nodes={
                    tab === "department"
                      ? (deptNodes(org.departments) as TreeNode<unknown>[])
                      : org.positions.map((position) => ({ key: position.id, title: position.name, count: position.count }))
                  }
                  selectedKey={nodeKey}
                  onSelect={(key) => {
                    setNodeKey(key);
                    setCheckedCandidates([]);
                  }}
                />
              </>
            )}
          </AsyncView>
        </div>

        {/* 中：搜索 + 人员列表 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-md bg-card p-3">
          <Input
            aria-label="搜索人员"
            allowClear
            prefix={<Search />}
            placeholder="输入搜索"
            value={keywordDraft}
            onChange={(next) => setKeywordDraft(next)}
            onPressEnter={() => setKeyword(keywordDraft.trim())}
          />
          <div className="min-h-40 overflow-y-auto sm:h-[min(46vh,400px)]">
            <AsyncView
              result={persons}
              isEmpty={(data) => data.list.length === 0}
              empty={
                hasScope ? (
                  <Empty description="暂无人员" size="sm" />
                ) : (
                  <Empty image={<Hand className="size-8 stroke-[1.4] text-text-tertiary" />} description="请选择左侧" size="sm" className="h-full" />
                )
              }
            >
              {(data) => (
                <ul className="grid gap-0.5" aria-label="人员列表">
                  {data.list.map((person) => {
                    const detail = [person.departmentName, person.positionName].filter(Boolean).join(" · ");
                    const checked = multiple ? checkedCandidates.includes(person.id) : checkedCandidates[0] === person.id;
                    return (
                      <PersonRow
                        key={person.id}
                        person={{ ...toRef(person), detail: `${person.code}${detail ? ` · ${detail}` : ""}` }}
                        multiple={multiple}
                        checked={checked || (!multiple && selectedIds.has(person.id) && checkedCandidates.length === 0)}
                        onToggle={(next) => {
                          if (!multiple) {
                            setCheckedCandidates([person.id]);
                            return;
                          }
                          setCheckedCandidates((current) =>
                            next ? [...current, person.id] : current.filter((id) => id !== person.id),
                          );
                        }}
                        onActivate={() => addPersons([toRef(person)])}
                      />
                    );
                  })}
                </ul>
              )}
            </AsyncView>
          </div>
        </div>

        {/* 穿梭 */}
        <div className="flex shrink-0 items-center justify-center gap-2 sm:flex-col">
          <Button variant="outline" size="md" aria-label="加入已选" disabled={checkedCandidates.length === 0} onClick={moveRight}>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="md"
            aria-label="移出已选"
            disabled={checkedSelected.length === 0}
            onClick={() => removePersons(checkedSelected)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        {/* 右：已选 */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 sm:w-[28%]">
          <div className="text-sm text-foreground">已选：{selected.length}</div>
          <div className="flex min-h-40 flex-1 flex-col rounded-md bg-card p-2 sm:h-[min(46vh,420px)]">
            <div className="border-b border-border-secondary px-2 pb-2">
              <Checkbox
                checked={allSelectedChecked}
                indeterminate={checkedSelected.length > 0 && !allSelectedChecked}
                disabled={selected.length === 0}
                onChange={(next) => setCheckedSelected(next ? selected.map((person) => person.id) : [])}
              >
                全选
              </Checkbox>
            </div>
            <ul className="mt-1 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto" aria-label="已选人员">
              {selected.map((person) => (
                <li
                  key={person.id}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-fill-hover"
                  onDoubleClick={() => removePersons([person.id])}
                >
                  <Checkbox
                    checked={checkedSelected.includes(person.id)}
                    onChange={(next) =>
                      setCheckedSelected((current) => (next ? [...current, person.id] : current.filter((id) => id !== person.id)))
                    }
                    className="min-w-0 flex-1"
                  >
                    <span className="truncate">
                      {person.name}
                      {person.code ? <span className="ml-1 text-xs text-text-tertiary">{person.code}</span> : null}
                    </span>
                  </Checkbox>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" onClick={() => onConfirm(selected)}>
          保存
        </Button>
      </div>
    </div>
  );
}

export function PersonPicker({ open, onOpenChange, multiple = false, value, title = "选择人员", onConfirm }: PersonPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="xl" contentClassName="px-4 py-4 sm:px-6 sm:py-5">
      {open ? (
        <PersonPickerBody
          multiple={multiple}
          value={value}
          onCancel={() => onOpenChange(false)}
          onConfirm={(persons) => {
            onConfirm(persons);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
