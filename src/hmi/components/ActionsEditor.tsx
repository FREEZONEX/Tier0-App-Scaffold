"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, ChevronUp, ChevronDown, Play, AlertTriangle } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { UnsTopicInput } from "./UnsTopicInput";
import { splitActions } from "@/hmi/symbols/action-buttons";
import { parsePayload } from "@/hmi/data/payload";
import { examplePayloadJson, unsTopicFieldSchema } from "@/hmi/data/uns-topic-fields";
import type { MimicNode, DeviceAction, PublishMessage } from "@/hmi/schema/schema";

/** payload 仍是默认值（空 / "{}" / "{ }"）→ 可被 schema 示例覆盖；用户已写过内容则不覆盖。 */
const isDefaultPayload = (template: string): boolean => {
  const t = template.trim();
  return t === "" || t === "{}" || t === "{ }";
};

/** 选定 topic 后：若该 topic 有缓存的字段 schema 且 payload 还是默认值，回填示例 JSON；否则原样。 */
const payloadForPickedTopic = (topic: string, current: string): string => {
  if (!isDefaultPayload(current)) return current; // 别覆盖用户已写的
  const example = examplePayloadJson(unsTopicFieldSchema(topic));
  return example ?? current;
};

/** 行草稿：允许未填完（空 topic 行提交时过滤；动作 0 条有效消息则整条不落库）。 */
interface DraftAction { label: string; items: PublishMessage[]; confirm: boolean; more: boolean }

const toDraft = (a: DeviceAction): DraftAction => ({ label: a.label, items: [...a.items], confirm: a.confirm ?? false, more: false });
const NEW_DRAFT = (label: string): DraftAction => ({ label, items: [{ topic: "", template: "{}" }], confirm: false, more: false });

export function ActionsEditor({
  node,
  onSetActions,
  onTestSend,
}: {
  node: MimicNode;
  onSetActions: (actions: DeviceAction[] | undefined) => void;
  /** 试发送：admin 调试，不走确认弹窗，逐条直发。 */
  onTestSend: (items: readonly PublishMessage[]) => void;
}) {
  const t = useT();
  const [drafts, setDrafts] = useState<DraftAction[]>(() => (node.actions ?? []).map(toDraft));
  // 本组件最后提交/同步的 actions 序列化值：区分「自己 commit 的 props 回流」（JSON 相等，跳过）
  // 与「外部变更」（undo/redo/上传 schema → 重置草稿），避免失焦把旧草稿写回、静默覆盖 undo。
  const lastSyncedRef = useRef(JSON.stringify(node.actions ?? null));
  useEffect(() => {
    const incoming = JSON.stringify(node.actions ?? null);
    if (incoming === lastSyncedRef.current) return;
    lastSyncedRef.current = incoming;
    setDrafts((node.actions ?? []).map(toDraft));
  }, [node.actions]);

  const sanitize = (list: DraftAction[]): DeviceAction[] =>
    list
      .map((d) => ({
        label: d.label.trim(),
        items: d.items.filter((m) => m.topic.trim() !== "").map((m) => ({ topic: m.topic.trim(), template: m.template })),
        ...(d.confirm ? { confirm: true as const } : {}),
      }))
      .filter((a) => a.label !== "" && a.items.length > 0);

  /** 更新草稿；save=true 时提交 sanitize 结果（上层按现值幂等跳过），并记录提交值供外部变更判别。 */
  const update = (next: DraftAction[], save: boolean) => {
    setDrafts(next);
    if (save) {
      const clean = sanitize(next);
      const committed = clean.length > 0 ? clean : undefined;
      lastSyncedRef.current = JSON.stringify(committed ?? null);
      onSetActions(committed);
    }
  };
  const commit = () => update(drafts, true);

  const { direct } = splitActions(sanitize(drafts).length || drafts.length);

  if (drafts.length === 0) {
    return (
      <button
        type="button"
        onClick={() => update([NEW_DRAFT("")], false)}
        data-testid="actions-empty-add"
        className="mb-4 flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border px-2 py-3 text-xs text-muted-foreground hover:bg-surface-inset hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {t("给这台设备加一个操作按钮")}
      </button>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-2" data-testid="actions-editor" onBlur={commit}>
      {drafts.map((d, i) => (
        <div key={i} className="rounded-sm border border-border p-1.5" data-testid={`action-row-${i}`}>
          <div className="mb-1 flex items-center gap-1">
            <input
              value={d.label}
              onChange={(e) => update(drafts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)), false)}
              placeholder={t("按钮文字")}
              aria-label={t("按钮文字")}
              data-testid={`action-label-${i}`}
              className="h-6 min-w-0 flex-1 rounded-sm border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:border-focus-accent"
            />
            <span className="shrink-0 rounded-sm bg-surface-inset px-1 py-0.5 text-[9px] text-muted-foreground">
              {direct.includes(i) ? t("图上直达") : t("收进 ⋯ 菜单")}
            </span>
            <button type="button" onClick={() => onTestSend(sanitize([d])[0]?.items ?? [])} title={t("试发送（不弹确认，当场验证）")} aria-label={t("试发送")} data-testid={`action-test-${i}`} className="shrink-0 text-muted-foreground hover:text-foreground"><Play className="size-3" /></button>
            <button type="button" disabled={i === 0} onClick={() => { const n = [...drafts]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; update(n, true); }} aria-label={t("上移")} className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="size-3" /></button>
            <button type="button" disabled={i === drafts.length - 1} onClick={() => { const n = [...drafts]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; update(n, true); }} aria-label={t("下移")} className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="size-3" /></button>
            <button type="button" onClick={() => update(drafts.filter((_, j) => j !== i), true)} aria-label={t("删除该操作")} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
          </div>
          {(() => {
            const noLabel = d.label.trim() === "";
            const noTopic = d.items.every((m) => m.topic.trim() === "");
            if (!noLabel && !noTopic) return null;
            const msg = noLabel && noTopic ? t("按钮文字、发布主题都要填，否则不会保存") : noLabel ? t("留空则不保存、不显示按钮") : t("未填发布主题，不会保存、不会显示按钮");
            return (
              <p
                className="mb-1 flex items-center gap-1 rounded-sm border border-state-paused-border bg-state-paused-bg px-1.5 py-1 text-[10px] font-medium text-state-paused-fg"
                data-testid={`action-label-hint-${i}`}
              >
                <AlertTriangle className="size-3 shrink-0" />
                {msg}
              </p>
            );
          })()}
          {/* 第一条消息默认展开（必填项就近）；其余收进「更多」 */}
          {(d.more ? d.items : d.items.slice(0, 1)).map((m, mi) => (
            <div key={mi} className="mb-1 rounded-sm border border-border p-1">
              <div className="mb-1 flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <UnsTopicInput
                    value={m.topic}
                    onChange={(v) => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.map((y, k) => (k === mi ? { ...y, topic: v } : y)) } : x)), false)}
                    onSelect={(v) =>
                      // 选定 topic：回填 topic，并按 topic 的字段 schema 自动填示例 payload（仅当 payload 仍为默认值）
                      update(
                        drafts.map((x, j) =>
                          j === i
                            ? { ...x, items: x.items.map((y, k) => (k === mi ? { ...y, topic: v, template: payloadForPickedTopic(v, y.template) } : y)) }
                            : x,
                        ),
                        true,
                      )
                    }
                    placeholder={t("发到哪个主题 topic")}
                    testId={`action-${i}-topic-${mi}`}
                  />
                </div>
                {d.items.length > 1 ? (
                  <button type="button" onClick={() => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.filter((_, k) => k !== mi) } : x)), true)} aria-label={t("删除该条消息")} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                ) : null}
              </div>
              <textarea
                value={m.template}
                onChange={(e) => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.map((y, k) => (k === mi ? { ...y, template: e.target.value } : y)) } : x)), false)}
                placeholder={t("发什么内容 payload")}
                aria-label={t("发什么内容 payload")}
                data-testid={`action-${i}-payload-${mi}`}
                rows={3}
                className="w-full resize-y rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-foreground outline-none focus:border-focus-accent"
              />
              {typeof parsePayload(m.template) === "string" && m.template.trim().startsWith("{") ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t("不是合法 JSON，将按原文发送")}</p>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => update(drafts.map((x, j) => (j === i ? { ...x, more: !x.more } : x)), false)}
            data-testid={`action-more-${i}`}
            className="flex items-center gap-1 rounded-sm border border-dashed border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-surface-inset hover:text-foreground"
          >
            {d.more ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
            {d.more ? t("收起更多设置") : t("更多设置（多条消息 / 发送确认）")}
          </button>
          {d.more ? (
            <div className="mt-1 flex flex-col gap-1">
              <button type="button" onClick={() => update(drafts.map((x, j) => (j === i ? { ...x, items: [...x.items, { topic: "", template: "{}" }] } : x)), false)} className="flex w-full items-center justify-center gap-0.5 rounded-sm border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-inset hover:text-foreground">
                <Plus className="size-3" />
                {t("添加消息")}
              </button>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <input type="checkbox" checked={d.confirm} onChange={(e) => update(drafts.map((x, j) => (j === i ? { ...x, confirm: e.target.checked } : x)), true)} data-testid={`action-confirm-${i}`} />
                {t("发送前弹窗确认")}
              </label>
            </div>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => update([...drafts, NEW_DRAFT("")], false)} data-testid="actions-add" className="flex w-full items-center justify-center gap-0.5 rounded-sm border border-dashed border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-surface-inset hover:text-foreground">
        <Plus className="size-3" />
        {t("添加操作")}
      </button>
    </div>
  );
}
