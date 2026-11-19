"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, ClipboardList, Copy, FileSearch, PanelRightClose, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { FieldGroup } from "@/components/forms";
import { TextArea } from "@/components/kit/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RiskBanner } from "@/components/ui/risk-banner";
import {
  ChatActionPanel,
  ChatCodeBlock,
  ChatComposer,
  ChatDock,
  ChatHistorySelect,
  ChatLauncher,
  ChatMessage,
  ChatMetricCard,
  ChatMetricRow,
  ChatNewButton,
  ChatPanel,
  ChatPromptChips,
  ChatReasoning,
  ChatRetrieval,
  ChatAvatar,
  ChatStatus,
  ChatThread,
  ChatToolGroup,
  type ChatActionStatus,
  type ChatCitation,
  type ChatHistoryItem,
  type ChatLauncherMode,
  type ChatMetricTone,
  type ChatReasoningStep,
  type ChatRetrievalItem,
  type ChatRole,
  type ChatToolCallItem,
} from "@/components/ui";
import { useSimulatedStream } from "@/lib/text-reveal";

type Turn = {
  id: string;
  role: ChatRole;
  name: string;
  text: string;
  citations?: ChatCitation[];
  insert?: string;
  code?: { filename: string; body: string };
  reasoning?: string;
  reasoningSteps?: ChatReasoningStep[];
  reasoningMs?: number;
  tools?: ChatToolCallItem[];
  metrics?: {
    id: string;
    label: string;
    value: number;
    unit?: string;
    hint?: string;
    tone?: ChatMetricTone;
  }[];
  action?: {
    title: string;
    description?: string;
    details?: { label: string; value: string }[];
    primaryLabel: string;
    confirm?: { title: string; description: string };
    destructive?: boolean;
    doneLabel?: string;
  };
};

type StoredSession = ChatHistoryItem & { turns: Turn[] };

const STARTERS = [
  { id: "alarm", label: "这条告警是什么意思" },
  { id: "reset", label: "如何复位扭矩传感器" },
  { id: "check", label: "本班还缺哪些点检" },
];

const RESET_CODE = `1. 夹具打到空载
2. 长按「传感器复位」至指示灯变绿
3. 空载读数 0.0–0.4 N·m
4. 标准件一拍，确认 38–42 N·m`;

const INSERT_SECTION = `工位 A-03 扭矩传感器连续 3 拍超上限（48.6 N·m / 上限 42.0）。已隔离本工位件。请设备员按 SOP-扭矩校准做传感器复位，复位失败再更换探头。`;

const REPLIES: Record<string, Omit<Turn, "id" | "role" | "name">> = {
  alarm: {
    text: `**ALM-4412** 表示装配二线工位 A-03 的扭矩传感器读数连续 3 拍超出上限。

- 当前读数 **48.6 N·m**，工艺上限 **42.0 N·m**
- 不影响整线急停，但本工位产出需隔离待复检
- 先按 SOP 做传感器复位，复位失败再叫设备员

不要继续放行该工位件。`,
    citations: [
      { id: "sop", label: "SOP-扭矩校准" },
      { id: "alm", label: "ALM-4412" },
    ],
    insert: INSERT_SECTION,
    reasoning: "对照了 SOP-扭矩校准第 4 节与当前工位 ALM-4412 的触发条件。",
    reasoningSteps: [
      { id: "s1", label: "对照 SOP-扭矩校准第 4 节" },
      { id: "s2", label: "核对 ALM-4412 触发条件" },
      { id: "s3", label: "确认本工位件隔离要求" },
    ],
    reasoningMs: 1400,
    tools: [
      {
        id: "t-alm",
        title: "查告警字典",
        name: "lookup_alarm",
        status: "done",
        input: { 编码: "ALM-4412" },
        output: { 含义: "扭矩连续 3 拍超上限", 处置: "隔离本工位件" },
        durationMs: 420,
      },
      {
        id: "t-sop",
        title: "读工艺文件",
        name: "read_sop",
        status: "done",
        input: { 文件: "SOP-扭矩校准", 章节: "第 4 节" },
        output: { 结论: "超上限先隔离，再按复位顺序操作" },
        durationMs: 680,
      },
    ],
    metrics: [
      { id: "m-now", label: "当前读数", value: 48.6, unit: "N·m", hint: "连续 3 拍", tone: "error" },
      { id: "m-max", label: "工艺上限", value: 42, unit: "N·m" },
      { id: "m-hold", label: "隔离件数", value: 1, unit: "件", hint: "本工位产出" },
    ],
    action: {
      title: "建议隔离本工位件",
      description: "未复位前不要放行 A-03 产出。",
      details: [
        { label: "工位", value: "A-03" },
        { label: "告警", value: "ALM-4412" },
        { label: "读数", value: "48.6 N·m" },
      ],
      primaryLabel: "隔离本工位件",
      confirm: {
        title: "隔离本工位件？",
        description: "工位 A-03 当前产出将标为待复检，本班不能放行。",
      },
      destructive: true,
      doneLabel: "已隔离本工位件，待复检。",
    },
  },
  reset: {
    text: `复位顺序（工位屏，约 40 秒）：

1. 将夹具打到 **空载**
2. 长按工位屏「传感器复位」至指示灯变绿
3. 空载读数应回到 **0.0–0.4 N·m**
4. 用标准件打一拍，确认落在 38–42 N·m

若第 2 步灯不绿，停工并开报修单，不要用手扳传感器。`,
    citations: [{ id: "sop", label: "SOP-扭矩校准" }],
    code: { filename: "SOP-扭矩校准 · 复位", body: RESET_CODE },
    reasoning: "摘自 SOP-扭矩校准「传感器复位」，不含未写入工艺的参数。",
    reasoningSteps: [
      { id: "s1", label: "打开 SOP-扭矩校准「传感器复位」" },
      { id: "s2", label: "核对本工位屏按键名称" },
    ],
    reasoningMs: 900,
    tools: [
      {
        id: "t-sop",
        title: "读工艺文件",
        name: "read_sop",
        status: "done",
        input: { 文件: "SOP-扭矩校准", 章节: "传感器复位" },
        output: { 步骤: "空载 → 长按复位 → 核对空载读数 → 标准件一拍" },
        durationMs: 510,
      },
    ],
  },
  check: {
    text: `本班（白班 · A-03）还缺：

- 班前点检第 4 项：扭矩仪比对（应 09:00 前完成）
- 首件确认单 **FA-2031** 尚未签字

其余 6 项已完成。点检未齐前不要把本工位切到自动。`,
    citations: [{ id: "chk", label: "点检表-装配二线" }],
    reasoning: "核对本班点检表与首件确认单签字栏。",
    reasoningSteps: [
      { id: "s1", label: "核对本班点检表完成栏" },
      { id: "s2", label: "核对手件确认单 FA-2031 签字" },
    ],
    reasoningMs: 760,
    tools: [
      {
        id: "t-chk",
        title: "查点检表",
        name: "query_checks",
        status: "done",
        input: { 工位: "A-03", 班次: "白班" },
        output: { 已完成: "6 项", 未完成: "扭矩仪比对、FA-2031" },
        durationMs: 390,
      },
    ],
    metrics: [
      { id: "c-ok", label: "已完成", value: 6, unit: "项" },
      { id: "c-gap", label: "未完成", value: 2, unit: "项", hint: "点检未齐勿切自动", tone: "warning" },
    ],
    action: {
      title: "打开本班点检表",
      description: "补齐扭矩仪比对和第 4 项签字后再切自动。",
      details: [
        { label: "工位", value: "A-03" },
        { label: "班次", value: "白班" },
      ],
      primaryLabel: "打开点检表",
      doneLabel: "已打开点检表-装配二线。",
    },
  },
};

const HISTORY_SEED: StoredSession[] = [
  {
    id: "hist-check",
    title: "本班点检缺口",
    preview: "还缺扭矩仪比对和首件确认",
    updatedAt: "今天 08:12",
    turns: [
      { id: "hist-check-u", role: "user", name: "操作员", text: "本班还缺哪些点检" },
      { id: "hist-check-a", role: "assistant", name: "工艺助手", ...REPLIES.check },
    ],
  },
  {
    id: "hist-reset",
    title: "传感器复位步骤",
    preview: "空载后长按复位至指示灯变绿",
    updatedAt: "昨天 16:40",
    turns: [
      { id: "hist-reset-u", role: "user", name: "操作员", text: "如何复位扭矩传感器" },
      { id: "hist-reset-a", role: "assistant", name: "工艺助手", ...REPLIES.reset },
    ],
  },
];

function replyFor(question: string) {
  const hit = STARTERS.find((item) => item.label === question);
  if (hit) return REPLIES[hit.id];
  if (question.includes("告警")) return REPLIES.alarm;
  if (question.includes("复位")) return REPLIES.reset;
  if (question.includes("点检")) return REPLIES.check;
  return {
    text: `已记下「${question}」。

当前工位上下文是 **A-03 / ALM-4412**。请改问告警含义、复位步骤或本班点检缺口，我按 SOP 回答，不编造未写入工艺的参数。`,
    citations: [{ id: "ctx", label: "工位 A-03" }],
    reasoning: "问题不在快捷范围内，只回上下文，不编造工艺参数。",
    reasoningSteps: [{ id: "s1", label: "对照当前工位上下文 A-03 / ALM-4412" }],
    reasoningMs: 400,
  } satisfies Omit<Turn, "id" | "role" | "name">;
}

function openCitation(label: string) {
  toast.success(`已打开 ${label}`);
}

function withCitationHandlers(citations?: ChatCitation[]): ChatCitation[] | undefined {
  if (!citations?.length) return citations;
  return citations.map((cite) => ({
    ...cite,
    onOpen: () => openCitation(cite.label),
  }));
}

function retrievalFor(text: string, citations?: ChatCitation[]): ChatRetrievalItem[] {
  const items = citations ?? [];
  if (!items.length) return [];
  return items.map((cite, index) => {
    const threshold = Math.ceil(((index + 1) / items.length) * Math.max(text.length, 1));
    const state = text.length === 0 ? "queued" : text.length >= threshold ? "used" : "read";
    return { id: cite.id, label: cite.label, state };
  });
}

function toolIcon(title: string) {
  if (title.includes("告警")) return <BookOpen aria-hidden />;
  if (title.includes("点检")) return <ClipboardList aria-hidden />;
  return <FileSearch aria-hidden />;
}

function toolsForTurn(turn: Turn, streaming: boolean): ChatToolCallItem[] {
  if (!turn.tools?.length) return [];
  const waiting = turn.id === "pending" && streaming && turn.text.length === 0;
  return turn.tools.map((tool) => ({
    ...tool,
    icon: toolIcon(tool.title),
    status: waiting ? "running" : tool.status,
  }));
}

function reasoningStepsFor(turn: Turn, streaming: boolean): ChatReasoningStep[] | undefined {
  const steps = turn.reasoningSteps;
  if (!steps?.length) return undefined;
  if (turn.id !== "pending" || !streaming) return steps;
  if (turn.text.length === 0) return steps.slice(0, 1);
  const shown = Math.min(steps.length, 1 + Math.ceil((turn.text.length / 80) * (steps.length - 1)));
  return steps.slice(0, shown);
}

function previewOf(turns: Turn[]) {
  const source =
    [...turns].reverse().find((turn) => turn.role === "assistant")?.text ??
    turns.find((turn) => turn.role === "user")?.text ??
    "";
  return source.replace(/\*\*/g, "").replace(/\n+/g, " ").trim().slice(0, 28);
}

function titleOf(turns: Turn[]) {
  return (
    turns.find((turn) => turn.role === "user")?.text.replace(/\s+/g, " ").trim().slice(0, 18) ?? "未命名对话"
  );
}

function archiveSession(
  sessions: StoredSession[],
  activeId: string | null,
  turns: Turn[],
): StoredSession[] {
  const frozen = turns.filter((turn) => turn.id !== "pending");
  if (!frozen.length) return sessions;
  const next: StoredSession = {
    id: activeId ?? crypto.randomUUID(),
    title: titleOf(frozen),
    preview: previewOf(frozen),
    updatedAt: "刚刚",
    turns: frozen,
  };
  if (activeId && sessions.some((item) => item.id === activeId)) {
    return sessions.map((item) => (item.id === activeId ? next : item));
  }
  return [next, ...sessions];
}

function useIndustrialChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>(HISTORY_SEED);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pendingTurn = useRef<Omit<Turn, "id" | "role" | "name" | "text"> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { text, done } = useSimulatedStream(pending, streaming);

  const clearDelay = () => {
    if (delayRef.current == null) return;
    clearTimeout(delayRef.current);
    delayRef.current = null;
  };

  useEffect(() => () => clearDelay(), []);

  useEffect(() => {
    if (!pending) return;
    setTurns((current) => {
      const last = current[current.length - 1];
      if (!last || last.id !== "pending") return current;
      if (last.text === text) return current;
      return [...current.slice(0, -1), { ...last, text }];
    });
  }, [pending, text]);

  useEffect(() => {
    if (!done || !pending || !streaming) return;
    const extra = pendingTurn.current;
    setTurns((current) => {
      const last = current[current.length - 1];
      if (!last || last.id !== "pending") return current;
      return [
        ...current.slice(0, -1),
        {
          ...last,
          id: `a-${crypto.randomUUID()}`,
          text: pending,
          citations: extra?.citations,
          insert: extra?.insert,
          code: extra?.code,
          reasoning: extra?.reasoning,
          reasoningSteps: extra?.reasoningSteps,
          reasoningMs: extra?.reasoningMs,
          tools: extra?.tools,
          metrics: extra?.metrics,
          action: extra?.action,
        },
      ];
    });
    setPending(null);
    setStreaming(false);
    pendingTurn.current = null;
  }, [done, pending, streaming]);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;
    const answer = replyFor(trimmed);
    pendingTurn.current = answer;
    clearDelay();
    setTurns((current) => [
      ...current,
      {
        id: `u-${crypto.randomUUID()}`,
        role: "user",
        name: "操作员",
        text: trimmed,
      },
      {
        id: "pending",
        role: "assistant",
        name: "工艺助手",
        text: "",
        citations: answer.citations,
        reasoningSteps: answer.reasoningSteps,
        tools: answer.tools,
      },
    ]);
    setDraft("");
    setPending(null);
    setStreaming(true);
    delayRef.current = setTimeout(() => {
      delayRef.current = null;
      setPending(answer.text);
    }, 1100);
  };

  const stop = () => {
    clearDelay();
    setStreaming(false);
    setTurns((current) => {
      const last = current[current.length - 1];
      if (!last || last.id !== "pending") return current;
      const frozen = last.text.trim() || "已停止生成。";
      return [...current.slice(0, -1), { ...last, id: `a-${crypto.randomUUID()}`, text: frozen }];
    });
    setPending(null);
    pendingTurn.current = null;
  };

  const reset = () => {
    clearDelay();
    if (turns.length) setSessions(archiveSession(sessions, activeId, turns));
    setTurns([]);
    setActiveId(null);
    setPending(null);
    setStreaming(false);
    setDraft("");
    pendingTurn.current = null;
    toast.success("已开始新对话");
  };

  const openSession = (id: string) => {
    if (id === activeId && turns.length > 0) return;
    clearDelay();
    const nextSessions = turns.length ? archiveSession(sessions, activeId, turns) : sessions;
    const target = nextSessions.find((item) => item.id === id);
    setSessions(nextSessions);
    setTurns(target?.turns ?? []);
    setActiveId(id);
    setPending(null);
    setStreaming(false);
    setDraft("");
    pendingTurn.current = null;
  };

  const deleteSession = (id: string) => {
    if (id === activeId) {
      clearDelay();
      setTurns([]);
      setActiveId(null);
      setPending(null);
      setStreaming(false);
      setDraft("");
      pendingTurn.current = null;
    }
    setSessions((current) => current.filter((item) => item.id !== id));
    toast.success("已删除对话");
  };

  const history: ChatHistoryItem[] = sessions.map(({ id, title, preview, updatedAt }) => ({
    id,
    title,
    preview,
    updatedAt,
  }));

  const storedTitle = activeId ? sessions.find((item) => item.id === activeId)?.title : undefined;
  const currentTitle =
    storedTitle ||
    (turns.length ? titleOf(turns.filter((turn) => turn.id !== "pending")) : "新对话");

  return {
    turns,
    draft,
    setDraft,
    streaming,
    ask,
    stop,
    reset,
    history,
    activeId,
    currentTitle,
    openSession,
    deleteSession,
  };
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success("已复制"),
    (error) => {
      console.error(error);
      toast.error("复制失败，请重试");
    },
  );
}

function threadKeyOf(chat: ReturnType<typeof useIndustrialChat>) {
  return chat.activeId ?? (chat.turns.length ? "live" : "empty");
}

function HistoryTitle({ chat }: { chat: ReturnType<typeof useIndustrialChat> }) {
  return (
    <ChatHistorySelect
      items={chat.history}
      activeId={chat.activeId}
      currentTitle={chat.currentTitle}
      onSelect={chat.openSession}
      onDelete={chat.deleteSession}
    />
  );
}

function TurnBody({
  turn,
  streaming,
  insertAction,
}: {
  turn: Turn;
  streaming: boolean;
  insertAction?: ReactNode;
}) {
  const waiting = turn.id === "pending" && streaming && turn.text.length === 0;
  const live = turn.id === "pending" && streaming;
  const retrieval = live ? retrievalFor(turn.text, turn.citations) : [];
  const tools = toolsForTurn(turn, streaming);
  const steps = reasoningStepsFor(turn, streaming);
  const [actionStatus, setActionStatus] = useState<ChatActionStatus>("pending");

  const extra =
    waiting ||
    retrieval.length > 0 ||
    tools.length > 0 ||
    turn.reasoning ||
    steps ||
    turn.code ||
    (turn.metrics && !live) ||
    (turn.action && !live);

  return (
    <ChatMessage
      role={turn.role}
      name={turn.name}
      text={turn.text}
      streaming={live}
      citations={withCitationHandlers(turn.citations)}
      extra={
        extra ? (
          <>
            {waiting && !steps && !turn.reasoning ? (
              <ChatStatus state="waiting" label="正在查 SOP-扭矩校准" />
            ) : null}
            {steps || turn.reasoning ? (
              <ChatReasoning
                status={live ? "thinking" : "done"}
                durationMs={turn.reasoningMs}
                steps={steps}
              >
                {!live ? turn.reasoning : null}
              </ChatReasoning>
            ) : null}
            {tools.length > 0 ? <ChatToolGroup items={tools} /> : null}
            {retrieval.length > 0 ? <ChatRetrieval items={retrieval} /> : null}
            {turn.metrics && !live ? (
              <ChatMetricRow>
                {turn.metrics.map((metric) => (
                  <ChatMetricCard
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    unit={metric.unit}
                    hint={metric.hint}
                    tone={metric.tone}
                  />
                ))}
              </ChatMetricRow>
            ) : null}
            {turn.code && !live ? (
              <ChatCodeBlock filename={turn.code.filename} code={turn.code.body} />
            ) : null}
            {turn.action && !live ? (
              <ChatActionPanel
                title={turn.action.title}
                description={turn.action.description}
                details={turn.action.details}
                status={actionStatus}
                primaryLabel={turn.action.primaryLabel}
                confirm={turn.action.confirm}
                destructive={turn.action.destructive}
                doneLabel={turn.action.doneLabel}
                secondary={insertAction}
                onDismiss={
                  turn.action.destructive ? () => setActionStatus("dismissed") : undefined
                }
                onPrimary={() => {
                  toast.success(turn.action?.doneLabel ?? `已${turn.action?.primaryLabel}`);
                  setActionStatus("done");
                }}
              />
            ) : null}
          </>
        ) : null
      }
      actions={
        turn.role === "assistant" && !live && !turn.action ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              icon={<Copy />}
              onClick={() => copyText(turn.text)}
            >
              复制
            </Button>
            {insertAction}
          </>
        ) : turn.role === "assistant" && !live ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            icon={<Copy />}
            onClick={() => copyText(turn.text)}
          >
            复制
          </Button>
        ) : null
      }
    />
  );
}

function AssistantEmpty() {
  return (
    <EmptyState
      size="sm"
      plainIcon
      icon={<ChatAvatar size={32} />}
      title="还没有提问"
      description="先问当前告警，或从下面选一条。历史对话在标题栏打开。"
    />
  );
}

/**
 * 工艺助手 — ReUI ai-chat-1 / 3 full-page surface with simulated token stream.
 * Live apps replace useSimulatedStream with App SSE (`openEventStream`).
 */
export function SceneAiChat() {
  const chat = useIndustrialChat();

  return (
    <div className="page-shell flex h-full min-h-0 flex-col">
      <ChatPanel
        title={<HistoryTitle chat={chat} />}
        showMark={false}
        threadKey={threadKeyOf(chat)}
        busy={chat.streaming}
        actions={<ChatNewButton onClick={chat.reset} />}
        context={
          <RiskBanner
            severity="warning"
            action={
              <Button size="sm" variant="outline" onClick={() => chat.ask(STARTERS[0].label)}>
                询问含义
              </Button>
            }
          >
            工位 A-03 扭矩传感器告警 ALM-4412，本工位件需隔离。
          </RiskBanner>
        }
        empty={<AssistantEmpty />}
        prompts={
          chat.turns.length === 0 ? (
            <ChatPromptChips
              items={STARTERS}
              onSelect={(id) => chat.ask(STARTERS.find((item) => item.id === id)?.label ?? "")}
            />
          ) : null
        }
        composer={
          <ChatComposer
            value={chat.draft}
            onChange={chat.setDraft}
            onSubmit={chat.ask}
            onStop={chat.stop}
            streaming={chat.streaming}
          />
        }
      >
        {chat.turns.map((turn) => (
          <TurnBody key={turn.id} turn={turn} streaming={chat.streaming} />
        ))}
      </ChatPanel>
    </div>
  );
}

const REPAIR_SEED = `工位：装配二线 A-03
现象：扭矩读数连续超上限，本工位件已隔离。
`;

/**
 * 侧栏助手 — ReUI ai-chat-2 docked assistant. Insert writes a drafted
 * section into the repair form; Undo takes it out.
 */
export function SceneAiDock() {
  const chat = useIndustrialChat();
  const [open, setOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  const [repair, setRepair] = useState(REPAIR_SEED);
  const [inserted, setInserted] = useState<string | null>(null);

  const insert = (section: string) => {
    if (inserted) {
      toast.error("草稿里已有这段说明，先撤回再写入");
      return;
    }
    setRepair((current) => `${current.trimEnd()}\n\n${section}\n`);
    setInserted(section);
    toast.success("已写入报修草稿");
  };

  const undo = () => {
    if (!inserted) return;
    setRepair((current) => current.replace(`\n\n${inserted}\n`, "\n").replace(`\n\n${inserted}`, "\n"));
    setInserted(null);
    toast.success("已从草稿撤回");
  };

  const insertAction = (turn: Turn) => {
    if (!turn.insert) return null;
    if (inserted === turn.insert) {
      return (
        <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={undo}>
          撤回
        </Button>
      );
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-xs"
        onClick={() => insert(turn.insert!)}
      >
        写入草稿
      </Button>
    );
  };

  return (
    <ChatDock
      open={open}
      onOpenChange={setOpen}
      title="对话"
      className="h-full min-h-0"
      assistant={
        <ChatPanel
          flush
          busy={chat.streaming}
          showMark={false}
          threadKey={threadKeyOf(chat)}
          title={<HistoryTitle chat={chat} />}
          actions={
            <>
              <ChatNewButton onClick={chat.reset} />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
                aria-label={open ? "收起助手" : "打开助手"}
                title={open ? "收起助手" : "打开助手"}
                onClick={() => setOpen((current) => !current)}
              >
                {open ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
              </Button>
            </>
          }
          empty={<AssistantEmpty />}
          prompts={
            chat.turns.length === 0 ? (
              <ChatPromptChips
                items={STARTERS}
                onSelect={(id) => chat.ask(STARTERS.find((item) => item.id === id)?.label ?? "")}
              />
            ) : null
          }
          composer={
            <ChatComposer
              value={chat.draft}
              onChange={chat.setDraft}
              onSubmit={chat.ask}
              onStop={chat.stop}
              streaming={chat.streaming}
              placeholder="问告警或复位步骤"
            />
          }
        >
          {chat.turns.map((turn) => (
            <TurnBody
              key={turn.id}
              turn={turn}
              streaming={chat.streaming}
              insertAction={insertAction(turn)}
            />
          ))}
        </ChatPanel>
      }
    >
      <div className="page-shell flex h-full min-h-0 flex-col gap-4">
        <PageHeader title="报修草稿" />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          <FieldGroup label="故障说明" required htmlFor="repair-draft">
            <TextArea
              id="repair-draft"
              value={repair}
              onChange={(value) => setRepair(value)}
              autoSize={{ minRows: 8, maxRows: 18 }}
              placeholder="助手点「写入草稿」会把建议段落追加到这里"
            />
          </FieldGroup>
          {inserted ? (
            <p className="text-xs leading-5 text-muted-foreground">草稿已写入助手建议，可撤回。</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              先问告警含义，再把建议说明写入左侧草稿。
            </p>
          )}
        </div>
      </div>
    </ChatDock>
  );
}

/**
 * 角落助手 — ReUI ai-chat-13 launcher. The window scales from the
 * bottom-right ChatAvatar FAB (hover: AI 助手); unread is a dot on
 * the circle; keep a deletable recent-question list.
 */
export function SceneAiLauncher() {
  const chat = useIndustrialChat();
  const [mode, setMode] = useState<ChatLauncherMode>("open");
  const [unread, setUnread] = useState(false);
  const wasStreaming = useRef(false);

  useEffect(() => {
    if (chat.streaming) {
      wasStreaming.current = true;
      return;
    }
    if (wasStreaming.current && mode !== "open") setUnread(true);
    wasStreaming.current = false;
  }, [chat.streaming, mode]);

  const onModeChange = (next: ChatLauncherMode) => {
    setMode(next);
    if (next === "open") setUnread(false);
  };

  return (
    <div className="page-shell relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <PageHeader title="SOP-扭矩校准" />
      <article className="min-w-0 max-w-prose space-y-3 text-sm leading-6">
        <p>
          装配二线工位 A-03 使用本规程做扭矩传感器复位。超上限时先隔离本工位件，再按复位顺序操作；灯不绿则开报修，不要用手扳探头。
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>夹具打到空载</li>
          <li>长按「传感器复位」至指示灯变绿</li>
          <li>空载读数 0.0–0.4 N·m</li>
          <li>标准件一拍，确认 38–42 N·m</li>
        </ol>
        <p className="text-muted-foreground">右下角助手可就本页提问；最小化后新回复会打标。</p>
      </article>
      <ChatLauncher
        mode={mode}
        onModeChange={onModeChange}
        title={<HistoryTitle chat={chat} />}
        barLabel={chat.currentTitle}
        showMark={false}
        unread={unread}
        busy={chat.streaming}
        actions={<ChatNewButton onClick={chat.reset} />}
        panel={
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatThread empty={<AssistantEmpty />} threadKey={threadKeyOf(chat)}>
              {chat.turns.map((turn) => (
                <TurnBody key={turn.id} turn={turn} streaming={chat.streaming} />
              ))}
            </ChatThread>
            {chat.turns.length === 0 ? (
              <ChatPromptChips
                items={STARTERS}
                onSelect={(id) => chat.ask(STARTERS.find((item) => item.id === id)?.label ?? "")}
              />
            ) : null}
            <ChatComposer
              value={chat.draft}
              onChange={chat.setDraft}
              onSubmit={chat.ask}
              onStop={chat.stop}
              streaming={chat.streaming}
              placeholder="就本页 SOP 提问"
            />
          </div>
        }
      />
    </div>
  );
}
