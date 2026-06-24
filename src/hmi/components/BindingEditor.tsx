"use client";

import { useState } from "react";
import { TopicManager } from "./TopicManager";
import { WatchManager } from "./WatchManager";
import { FieldSource } from "./FieldSource";
import { BindingMapEditor, type Transform } from "./BindingMapEditor";
import { StateValueMap } from "./StateValueMap";
import { useT } from "@/hmi/i18n/context";
import type { MimicNode, Binding, WatchPoint } from "@/hmi/schema/schema";
import type { Capability, StateField } from "@/hmi/symbols/capabilities";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette } from "@/hmi/engine/theme";

/**
 * 字段绑定：先在顶部「订阅 Topic」加 topic，再为每个固定字段下拉选 topic→字段→填取值映射。
 * 字段是设备固定属性（契约），增删不了，只能配映射；要改来源直接换 topic 下拉覆盖。
 * 布尔：对着两个状态图标填判定条件；数值：量程 + 告警阈值（越限即报警）。
 */
export function BindingEditor({
  node,
  capability,
  registry,
  palette,
  getPayload,
  onSetBinding,
  onAddTopic,
  onRemoveTopic,
  onAddWatch,
  onRemoveWatch,
  onUpdateWatch,
}: {
  node: MimicNode;
  capability: Capability;
  registry: Registry;
  palette: Palette;
  getPayload: (topic: string) => unknown;
  onSetBinding: (field: string, binding: Binding) => void;
  onAddTopic: (topic: string) => void;
  onRemoveTopic: (topic: string) => void;
  onAddWatch: (watch: WatchPoint) => void;
  onRemoveWatch: (index: number) => void;
  onUpdateWatch: (index: number, patch: Partial<WatchPoint>) => void;
}) {
  const t = useT();
  return (
    <div data-testid="binding-editor">
      <TopicManager topics={node.topics} onAdd={onAddTopic} onRemove={onRemoveTopic} />
      {capability.states.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">{t("该图元无可绑定状态字段。")}</p>
      ) : (
        <ul className="space-y-2">
          {capability.states.map((s) => (
            <FieldConfig
              key={s.key}
              field={s.key}
              state={s}
              capability={capability}
              registry={registry}
              palette={palette}
              topics={node.topics}
              getPayload={getPayload}
              binding={node.bindings[s.key]}
              onSet={(b) => onSetBinding(s.key, b)}
            />
          ))}
        </ul>
      )}
      <WatchManager watches={node.watches ?? []} topics={node.topics} getPayload={getPayload} onAdd={onAddWatch} onRemove={onRemoveWatch} onUpdate={onUpdateWatch} />
    </div>
  );
}

function transformOf(b?: Binding): Transform {
  return { map: b?.map, invert: b?.invert, scale: b?.scale, alarms: b?.alarms, unit: b?.unit };
}

function clean(o: Transform): Partial<Binding> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as Partial<Binding>;
}

/** 绑定身份键：绑定变化时让映射 UI 重挂、从最新 binding 同步。 */
function bindingKey(b?: Binding): string {
  return b ? `${b.topic}::${b.path}` : "unbound";
}

function FieldConfig({
  field,
  state,
  capability,
  registry,
  palette,
  topics,
  getPayload,
  binding,
  onSet,
}: {
  field: string;
  state: StateField;
  capability: Capability;
  registry: Registry;
  palette: Palette;
  topics: readonly string[];
  getPayload: (topic: string) => unknown;
  binding?: Binding;
  onSet: (b: Binding) => void;
}) {
  // 来源本地暂存：支持「选了 topic 还没选字段」的中间态（此刻 binding 尚未建立 / 仍是旧值）。
  // 切设备时 Inspector 以 node.id 为 key 整体重挂，本地态自然重置。
  const [topic, setTopic] = useState(binding?.topic ?? "");
  const [path, setPath] = useState(binding?.path ?? "");
  // 映射直接读自 binding（不本地缓存），避免陈旧映射被重新选源复活。
  const tr = transformOf(binding);
  const t = useT();

  // 换来源：暂存到本地；topic+字段都齐才落库（带上当前 binding 已配映射 → 换 topic 不丢映射）。
  const onSource = (tp: string, pa: string) => {
    setTopic(tp);
    setPath(pa);
    if (tp && pa) onSet({ topic: tp, path: pa, ...clean(tr) });
  };
  const onTransform = (next: Transform) => {
    if (topic && path) onSet({ topic, path, ...clean(next) });
  };

  const bound = !!binding;
  const mapKey = bindingKey(binding);
  return (
    <li className="rounded-sm border border-border p-2">
      <div className="mb-1 flex items-center gap-1.5">
        <code className="text-[11px] font-medium text-foreground">{field}</code>
        <span className="text-[10px] text-muted-foreground">{state.kind === "number" ? `${t("数值")}${state.unit ? `(${state.unit})` : ""}` : t("开关量")}</span>
        <span className="flex-1" />
        <span className={`size-1.5 rounded-full ${bound ? "bg-state-running-fg" : "bg-muted-foreground/40"}`} title={bound ? t("已绑定") : t("未绑定")} />
      </div>

      {/* 数据来源：topic 下拉 → 字段下拉（标签独立一行 + 两个下拉各占整行，避免同行挤压截断） */}
      <div>
        <span className="text-[10px] text-muted-foreground">{t("来源")}</span>
        <div className="mt-0.5">
          <FieldSource topics={topics} topic={topic} path={path} getPayload={getPayload} onChange={onSource} />
        </div>
      </div>

      {/* 取值映射：布尔→对着状态图填判定条件；数值→量程+告警 */}
      <div className="mt-1.5">
        <span className="text-[10px] text-muted-foreground">{state.kind === "number" ? t("量程 / 告警") : t("取值映射")}</span>
        <div className="mt-0.5">
          {state.kind === "number" ? (
            <BindingMapEditor key={mapKey} kind="number" binding={binding} onChange={onTransform} />
          ) : (
            <StateValueMap
              key={mapKey}
              capability={capability}
              field={field}
              registry={registry}
              palette={palette}
              binding={binding}
              onChange={(patch) => onTransform({ ...tr, ...patch })}
            />
          )}
        </div>
      </div>
    </li>
  );
}
