"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ViewScopeSelect — 视图「使用范围」 (234_wo_view_edit.png, 01 §7.4 / §8): a tag box
 * (「所有人 ×」 by default) opening a checkable tree — 与我相关（当前用户）、
 * 部门（公司名 → 部门 + 人数，可展开子部门与人员）、所有人 — with search.
 *
 * Value is the view's `ViewScope`: `{ all: true }`, or `{ all: false, mine?, personIds,
 * departmentIds }` where 与我相关 (`mine`) means the view's creator. Choosing 所有人 clears the
 * other choices and vice versa.
 */
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AsyncView } from "@/components/data/async-view";
import { CheckboxIndicator } from "@/components/kit/ui/checkbox";
import { controlFrameClass } from "@/components/kit/ui/control-styles";
import { Input } from "@/components/kit/ui/input";
import { Popover } from "@/components/kit/ui/popover";
import { Tag } from "@/components/kit/ui/tag";

import { useRequest } from "@/lib/hooks";
import type { DeptNode, OrgTree, PersonLite, ViewScope } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";

export interface ViewScopeSelectProps {
  value: ViewScope;
  onChange: (scope: ViewScope) => void;
  status?: "error";
  placeholder?: string;
  "aria-label"?: string;
}

interface OrgData {
  tree: OrgTree;
  persons: PersonLite[];
}

/** True when nothing is chosen (neither 所有人 nor any person / department). */
export function isEmptyViewScope(scope: ViewScope | null | undefined): boolean {
  if (!scope) return true;
  return !scope.all && !scope.mine && !scope.personIds?.length && !scope.departmentIds?.length;
}

function ScopeRow({
  depth,
  label,
  extra,
  checked,
  expandable = false,
  expanded = false,
  onToggleExpand,
  onToggleCheck,
}: {
  depth: number;
  label: ReactNode;
  extra?: ReactNode;
  checked?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onToggleCheck?: () => void;
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={onToggleCheck ? Boolean(checked) : undefined}
      className="flex min-h-8 min-w-0 items-center gap-1 rounded-sm pr-2 text-sm hover:bg-fill-hover"
      style={{ paddingLeft: depth * 18 + 4 }}
    >
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? "收起" : "展开"}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:text-brand"
          onClick={onToggleExpand}
        >
          <svg
            viewBox="0 0 10 10"
            aria-hidden="true"
            className={cn("size-2.5 fill-current transition-transform duration-150", !expanded && "-rotate-90")}
          >
            <path d="M1 3h8L5 8z" />
          </svg>
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden="true" />
      )}
      {onToggleCheck ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={Boolean(checked)}
          className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-sm px-1 text-left text-foreground"
          onClick={onToggleCheck}
        >
          <CheckboxIndicator checked={checked} />
          <span className="min-w-0 truncate">{label}</span>
          {extra ? <span className="ml-auto shrink-0 pl-2 text-xs text-text-tertiary">{extra}</span> : null}
        </button>
      ) : (
        <button
          type="button"
          className="flex h-7 min-w-0 flex-1 items-center px-1 text-left font-medium text-foreground"
          onClick={onToggleExpand}
        >
          <span className="min-w-0 truncate">{label}</span>
        </button>
      )}
    </div>
  );
}

function ScopeTree({
  data,
  value,
  onChange,
}: {
  data: OrgData;
  value: ViewScope;
  onChange: (scope: ViewScope) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["group:department"]));
  const personIds = value.all ? [] : (value.personIds ?? []);
  const departmentIds = value.all ? [] : (value.departmentIds ?? []);
  const mine = !value.all && value.mine === true;
  const next = (patch: Pick<ViewScope, "mine" | "personIds" | "departmentIds">): ViewScope => {
    const merged = { mine, personIds, departmentIds, ...patch };
    return merged.mine
      ? { all: false, mine: true, personIds: merged.personIds, departmentIds: merged.departmentIds }
      : { all: false, personIds: merged.personIds, departmentIds: merged.departmentIds };
  };
  const text = keyword.trim().toLowerCase();

  const membersByDepartment = useMemo(() => {
    const map = new Map<string, PersonLite[]>();
    for (const person of data.persons) {
      if (!person.departmentId) continue;
      const list = map.get(person.departmentId) ?? [];
      list.push(person);
      map.set(person.departmentId, list);
    }
    return map;
  }, [data.persons]);

  const toggleExpand = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const togglePerson = (id: string) =>
    onChange(next({ personIds: personIds.includes(id) ? personIds.filter((item) => item !== id) : [...personIds, id] }));
  const toggleDepartment = (id: string) =>
    onChange(
      next({ departmentIds: departmentIds.includes(id) ? departmentIds.filter((item) => item !== id) : [...departmentIds, id] }),
    );
  const toggleMine = () => onChange(next({ mine: !mine }));
  const toggleAll = () => onChange(value.all ? { all: false, personIds: [], departmentIds: [] } : { all: true });

  const personRow = (person: PersonLite, depth: number, extra?: ReactNode) => (
    <ScopeRow
      key={`p-${person.id}-${depth}`}
      depth={depth}
      label={person.name}
      extra={extra}
      checked={personIds.includes(person.id)}
      onToggleCheck={() => togglePerson(person.id)}
    />
  );

  let body: ReactNode;
  if (text) {
    const departments: DeptNode[] = [];
    const walk = (nodes: readonly DeptNode[]) => {
      for (const node of nodes) {
        if (node.name.toLowerCase().includes(text)) departments.push(node);
        walk(node.children ?? []);
      }
    };
    walk(data.tree.departments);
    const persons = data.persons.filter(
      (person) => person.name.toLowerCase().includes(text) || person.code.toLowerCase().includes(text),
    );
    body =
      departments.length + persons.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-text-tertiary">无匹配结果</p>
      ) : (
        <>
          {departments.map((department) => (
            <ScopeRow
              key={`d-${department.id}`}
              depth={0}
              label={department.name}
              extra={`部门 · ${department.personCount}人`}
              checked={departmentIds.includes(department.id)}
              onToggleCheck={() => toggleDepartment(department.id)}
            />
          ))}
          {persons.map((person) => personRow(person, 0, person.departmentName ?? person.code))}
        </>
      );
  } else {
    const renderDepartment = (department: DeptNode, depth: number): ReactNode => {
      const key = `dept:${department.id}`;
      const members = membersByDepartment.get(department.id) ?? [];
      const open = expanded.has(key);
      return (
        <div key={key} role="group">
          <ScopeRow
            depth={depth}
            label={department.name}
            extra={`${department.personCount}人`}
            expandable={(department.children?.length ?? 0) > 0 || members.length > 0}
            expanded={open}
            onToggleExpand={() => toggleExpand(key)}
            checked={departmentIds.includes(department.id)}
            onToggleCheck={() => toggleDepartment(department.id)}
          />
          {open ? (
            <>
              {(department.children ?? []).map((child) => renderDepartment(child, depth + 1))}
              {members.map((person) => personRow(person, depth + 1, person.positionName ?? undefined))}
            </>
          ) : null}
        </div>
      );
    };
    body = (
      <>
        <ScopeRow depth={0} label="与我相关" extra="视图创建人" checked={mine} onToggleCheck={toggleMine} />
        <ScopeRow
          depth={0}
          label={`部门（${data.tree.company.name}）`}
          expandable
          expanded={expanded.has("group:department")}
          onToggleExpand={() => toggleExpand("group:department")}
        />
        {expanded.has("group:department") ? data.tree.departments.map((department) => renderDepartment(department, 1)) : null}
        <ScopeRow depth={0} label="所有人" extra="全部人员" checked={Boolean(value.all)} onToggleCheck={toggleAll} />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Input
        aria-label="搜索部门、人员"
        prefix={<Search />}
        allowClear
        placeholder="搜索部门、人员"
        value={keyword}
        onChange={setKeyword}
      />
      <div className="max-h-72 min-w-0 overflow-y-auto" role="tree" aria-label="使用范围">
        {body}
      </div>
    </div>
  );
}

export function ViewScopeSelect({
  value,
  onChange,
  status,
  placeholder = "请选择使用范围",
  "aria-label": ariaLabel = "使用范围",
}: ViewScopeSelectProps) {
  const api = useKitApi();
  const [open, setOpen] = useState(false);
  const org = useRequest("view-scope-org", async (signal) => {
    const [tree, persons] = await Promise.all([
      api.getJson<OrgTree>(apiUrl("/api/system/org/tree"), { signal }),
      api.getJson<{ list: PersonLite[] }>(apiUrl("/api/system/org/persons") + "?includeDisabled=true", { signal }),
    ]);
    return { tree, persons: persons.list } satisfies OrgData;
  });

  const names = useMemo(() => {
    const persons = new Map<string, string>();
    const departments = new Map<string, string>();
    for (const person of org.data?.persons ?? []) persons.set(person.id, person.name);
    const walk = (nodes: readonly DeptNode[]) => {
      for (const node of nodes) {
        departments.set(node.id, node.name);
        walk(node.children ?? []);
      }
    };
    walk(org.data?.tree.departments ?? []);
    return { persons, departments };
  }, [org.data]);

  const rest = (patch: Pick<ViewScope, "mine" | "personIds" | "departmentIds">): ViewScope => {
    const merged = { mine: value.mine === true, personIds: value.personIds ?? [], departmentIds: value.departmentIds ?? [], ...patch };
    return merged.mine
      ? { all: false, mine: true, personIds: merged.personIds, departmentIds: merged.departmentIds }
      : { all: false, personIds: merged.personIds, departmentIds: merged.departmentIds };
  };
  const tags: { key: string; label: string; remove: () => void }[] = value.all
    ? [{ key: "all", label: "所有人", remove: () => onChange({ all: false, personIds: [], departmentIds: [] }) }]
    : [
        ...(value.mine ? [{ key: "mine", label: "与我相关", remove: () => onChange(rest({ mine: false })) }] : []),
        ...(value.departmentIds ?? []).map((id) => ({
          key: `d-${id}`,
          label: names.departments.get(id) ?? id,
          remove: () => onChange(rest({ departmentIds: (value.departmentIds ?? []).filter((item) => item !== id) })),
        })),
        ...(value.personIds ?? []).map((id) => ({
          key: `p-${id}`,
          label: names.persons.get(id) ?? id,
          remove: () => onChange(rest({ personIds: (value.personIds ?? []).filter((item) => item !== id) })),
        })),
      ];

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      sameWidth="min"
      anchorClassName="w-full"
      aria-label={ariaLabel}
      className="w-80 p-2"
      content={
        <AsyncView result={org} isEmpty={() => false}>
          {(data) => <ScopeTree data={data} value={value} onChange={onChange} />}
        </AsyncView>
      }
    >
      <div
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        tabIndex={0}
        data-bare-control=""
        className={cn(controlFrameClass({ status, active: open }), "min-h-8 cursor-pointer flex-wrap gap-1 px-[7px] py-[3px]")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {tags.length === 0 ? <span className="px-1 text-text-placeholder">{placeholder}</span> : null}
        {tags.map((tag) => (
          <Tag
            key={tag.key}
            closable
            onClose={(event) => {
              event.stopPropagation();
              tag.remove();
            }}
          >
            {tag.label}
          </Tag>
        ))}
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
      </div>
    </Popover>
  );
}
