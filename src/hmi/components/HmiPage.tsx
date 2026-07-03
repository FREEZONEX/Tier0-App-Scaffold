"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { HmiCanvas, type HmiCanvasHandle } from "./HmiCanvas";
import { Topbar } from "./Topbar";
import { Inspector } from "./Inspector";
import { StateLegend } from "./StateLegend";
import { Palette as PalettePanel } from "./Palette";
import { EditToolbar, type CanvasTool } from "./EditToolbar";
import { SelectionBar } from "./SelectionBar";
import { AlarmStrip } from "./AlarmStrip";
import { activeAlarms } from "@/hmi/scene/active-alarms";
import { useHistory } from "./useHistory";
import { I18nProvider, useI18n } from "@/hmi/i18n/context";
import { setCanvasLang, type Lang } from "@/hmi/i18n/translate";
import { createDefaultRegistry } from "@/hmi/symbols/default-registry";
import { buildScene, resolveNodeState, type NodeState } from "@/hmi/scene/scene";
import { stepSelection, describeSelection } from "@/hmi/scene/keyboard-nav";
import { resolveEdgeFlow } from "@/hmi/scene/edge-flow";
import { validateMimicAssets } from "@/hmi/symbols/validate-mimic";
import { getCapability } from "@/hmi/symbols/capabilities";
import { splitActions } from "@/hmi/symbols/action-buttons";
import { isSpinning } from "@/hmi/symbols/spin";
import { setNodeBinding, setNodeLabel, setNodeRotation, setNodeSize, setMimicName, addNodeTopic, removeNodeTopic, moveSelectionBy, addNode, addEdge, addEdgeEnds, removeEdge, removeNodes, addNodeWatch, removeNodeWatch, updateNodeWatch, setNodeActions, setEdgeEnd, setNodeProp, duplicateNodes, pasteNodes } from "@/hmi/schema/edit";
import { publishMessages } from "@/hmi/data/publish";
import { ControlDialog } from "./ControlDialog";
import { ActionOverflowMenu } from "./ActionOverflowMenu";
import { ContextMenu } from "./ContextMenu";
import { ActionsDialog } from "./ActionsDialog";
import { HistoryDialog } from "./HistoryDialog";
import { createTagStore } from "@/hmi/data/tag-store";
import { createDataSource, dataSourceKind } from "@/hmi/data/source-factory";
import { getTier0ConfigFn, type Tier0Config } from "@/hmi/data/tier0-config";
import { createMockSource } from "@/hmi/data/mock-source";
import { mockSpecsFromSchema } from "@/hmi/data/mock-spec";
import demoMimicJson from "@/hmi/data/demo-mimic.json";
import { mimicSchema } from "@/hmi/schema/schema";
import { readUnsFn } from "@/hmi/data/uns-api";
import { saveMimicFn, type MimicRecord } from "@/hmi/data/mimic-store";
import { saveDemoFn } from "@/hmi/data/demo-store";
import { MimicTitle } from "./MimicTitle";
import { schemaTopics } from "@/hmi/schema/topics";
import { getPalette, readPalette, type ThemeMode, type Palette } from "@/hmi/engine/theme";
import type { Mimic, MimicEdge, MimicNode, PublishMessage } from "@/hmi/schema/schema";
import type { ConnectionStatus, DataSource } from "@/hmi/data/data-source";

export function HmiPage({
  initialMimic,
  canEdit = true,
  initialLang = "zh",
}: {
  initialMimic: MimicRecord;
  canEdit?: boolean;
  initialLang?: Lang;
}) {
  return (
    <I18nProvider initialLang={initialLang}>
      <HmiPageInner initialMimic={initialMimic} canEdit={canEdit} />
    </I18nProvider>
  );
}

// 空图回落用的演示图（内置示例，只读展示、绝不落库）。模块级解析一次。
const DEMO_MIMIC: Mimic = mimicSchema.parse(demoMimicJson);

function HmiPageInner({ initialMimic, canEdit }: { initialMimic: MimicRecord; canEdit: boolean }) {
  const { lang, t } = useI18n();
  // 语言变化时同步画布渲染所用语言（画布在 React 外渲染）。
  useEffect(() => {
    setCanvasLang(lang);
  }, [lang]);
  // Tier0 MQTT 配置：走 server fn 读服务端**无前缀** process.env.TIER0_*。
  // 客户端不直接读 Tier0 环境变量；首屏 null → mock 兜底，拿到 host 非空 → 下方 source effect 重建为真实源。
  const [tier0Config, setTier0Config] = useState<Tier0Config | null>(null);
  // 🔧 诊断（用户要求保留）：把服务端注入的 tier0 配置 + 客户端构建变量明文打到浏览器控制台，
  // 用于核对平台到底有没有把 broker/凭证注进来。想撤掉就删这个 useEffect。
  useEffect(() => {
    getTier0ConfigFn()
      .then((cfg) => {
        setTier0Config(cfg);
        const e = (import.meta.env ?? {}) as Record<string, unknown>;
        const fmt = (v: unknown) => (v === undefined || v === null ? "(未注入)" : v === "" ? "(空串)" : String(v));
        console.log("[注入 env 诊断 · 明文]\n" + [
          `TIER0_MQTT_HOST = ${fmt(cfg.mqttHost)}  (server fn)`,
          `TIER0_MQTT_PORT = ${fmt(cfg.mqttPort)}  (server fn)`,
          `TIER0_API_KEY   = ${fmt(cfg.apiKey)}  (server fn)`,
          `VITE_DEMO_EDIT  = ${fmt(e.VITE_DEMO_EDIT)}`,
          `VITE_BASE_PATH  = ${fmt(e.VITE_BASE_PATH)}`,
          `MODE/DEV/PROD   = ${fmt(e.MODE)} / ${fmt(e.DEV)} / ${fmt(e.PROD)}`,
          `→ 数据源判定     = ${cfg.mqttHost ? "real（有 broker host，真连）" : "mock（无 host，模拟兜底）"}`,
        ].join("\n"));
      })
      .catch(() => setTier0Config(null));
  }, []);
  // 演示编辑（本地开关 VITE_DEMO_EDIT=1）：演示场景下把 DEMO_MIMIC 载入 history 直接编辑，改动经
  // 「保存画布」写回 demo-mimic.json（见 saveDemoFn），仍走 mock 源 + 演示徽标。生产不设此 env → 演示只读。
  const demoEditEnabled = import.meta.env?.VITE_DEMO_EDIT === "1";
  const demoScene = initialMimic.data.nodes.length === 0; // 真实图为空 = 演示场景
  const demoEdit = demoEditEnabled && demoScene;
  // schema 走历史栈（撤销/重做）。present 即当前画布；编辑动作 commit，拖拽 begin+replace 合并为一步。
  // demo-edit 下 history 装载 DEMO_MIMIC 作编辑目标（否则从真实图起步）。
  const history = useHistory<Mimic>(demoEdit ? DEMO_MIMIC : initialMimic.data);
  // 「演示」切换是否可用：**实时**跟随真实图（history.present）是否为空——编辑态画出首个节点（落库）后
  // 立即隐藏，无需刷新。demoEdit（本地开关）下 history 装 DEMO_MIMIC（非空），按首屏 demoScene 显示。
  const demoAvailable = demoEdit ? demoScene : history.present.nodes.length === 0;
  // 模式：编辑 / 预览 / 演示三态。**演示 = 钉死的只读参考样板**（「演示」切换仅 DB 空时出现，见 demoAvailable）：
  // 渲染内置示例图 DEMO_MIMIC（只读、不入历史/不落库、走 mock 源 + 🔵演示徽标）——AI 可参考它的画法，但绝不在其上二次修改。
  // 编辑/预览 = DB 真实图（AI 平台把客户图**全新生成**写进 DB）。DB 为空默认首屏进「演示」给好观感；DB 有真实图则**隐藏演示**、默认进编辑/预览。
  const [mode, setMode] = useState<"edit" | "preview" | "demo">(
    demoScene ? "demo" : canEdit ? "edit" : "preview",
  );
  // isDemo：处于演示态（演示标签 或 demo-edit 可编辑演示——都走 mock 源 + 演示徽标）。
  // 演示 = 只读样板：切到「演示」显 DEMO_MIMIC；「演示」切换仅真实图空时可用（demoAvailable 实时跟随 history.present），编辑出真实图就隐藏。
  // AI 在平台生成的真实图进 DB（编辑/预览读它），不在演示样板上二次修改。
  const isDemo = demoEdit || mode === "demo";
  // schema：演示用静态 DEMO_MIMIC（mock 源）；编辑/预览用 history.present（DB 真实图，可改、落库）。
  const schema = useMemo(() => (isDemo && !demoEdit ? DEMO_MIMIC : history.present), [isDemo, demoEdit, history.present]);

  // 自动保存：任何编辑（加 topic / 配绑定 / 改名 / 移动…）后防抖落库，避免没点「保存」就丢失。
  // 跳过初始加载（不重存刚载入的图）；拖拽已合并为一步，连续编辑只在停手后存一次。
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (isDemo) return; // 演示态不自动落库：只读演示绝不落库；demo-edit 改走「保存画布」显式写回 demo-mimic.json（避免每次编辑触发 JSON 文件 HMR 重载）
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    const tid = setTimeout(() => {
      void saveMimicFn({ data: { id: initialMimic.id, data: schema } }).catch(() => { /* 失败下次变更再存 */ });
    }, 800);
    return () => clearTimeout(tid);
  }, [schema, initialMimic.id, isDemo]);
  // 选中集合：单选=1 个（开检视面板），框选=多个（仅整组拖拽，不开面板）。
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  // 选中的连线集合（编辑态点击连线选中，与节点选择互斥）：高亮 + Del 删除；多选由未来 marquee 填充。
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<readonly string[]>([]);
  // 编辑权（admin）才能进「编辑」态（建图）；预览/演示 = 只读监控：隐藏元件库/工具条/多选条，
  // 画布只平移缩放+点选查看，检视面板只读。operator 无编辑权，固定只读。
  const editing = canEdit && (mode === "edit" || (demoEdit && mode === "demo"));
  // 画布工具：pan=拖动平移（默认，拖节点也只平移防误挪，相当于「只看」）、
  // select=拖节点移动/拖空白框选、line=画线连边。预览模式强制 pan。
  const [tool, setTool] = useState<CanvasTool>("pan");
  // 当前数据源引用（动作执行/试发送用：调当前 source.publish）
  const sourceRef = useRef<DataSource | null>(null);
  const canvasRef = useRef<HmiCanvasHandle>(null);
  // 固定白天模式（主题切换已隐藏，默认白天）。
  const themeMode: ThemeMode = "light";
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const registry = useMemo(() => createDefaultRegistry(), []);
  const scene = useMemo(() => buildScene(schema), [schema]);

  // 组态非阻断警告（未知 type / 悬空连线 / 联锁引用缺失）。
  // 用「已忽略的 schema 引用」记忆忽略态：换 schema 时引用自然不等 → 警告重新出现，无需 effect。
  const schemaWarnings = useMemo(() => validateMimicAssets(schema, registry), [schema, registry]);
  const [dismissedSchema, setDismissedSchema] = useState<Mimic | null>(null);
  const showWarnings = schemaWarnings.length > 0 && dismissedSchema !== schema;

  // 调色板从 globals.css 的 --hmi-* token 读取（DESIGN.md 不 fork token），缺失回落硬编码。
  // 初始用硬编码值；挂载/切主题后从根容器 computed style 读取实际 token 值。
  const rootRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette>(() => getPalette("light"));
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setPalette(readPalette((name) => getComputedStyle(el).getPropertyValue(name), themeMode));
  }, [themeMode]);

  // useState 惰性初始化：tagStore 创建一次且为稳定普通值（非 ref），可在渲染期安全读取
  const [tagStore] = useState(createTagStore);

  // 订阅 tagStore：数据变化时重渲染（重算报警 + 刷新 getState 闭包 + 检视嗅探的实时 payload）
  const snapshot = useSyncExternalStore(tagStore.subscribe, tagStore.getSnapshot, tagStore.getSnapshot);

  // 数据源连接：建立后保持，不随 schema 重建——否则每次改配置都会断连重连、broker 重推所有 topic
  // 的旧 retain，实时读数瞬间跳回旧值。schema 变更走下方 effect 的 source.update() 增量调整（见 §update）。
  // 演示模式：强制用 mock 源喂内置示例图（示例 topic 非真，固定 mock 才会动）；点「从空白开始」后
  // isDemo 翻假 → 本 effect 重建为真实环境源（这次重连是切出演示的有意动作，非编辑触发）。
  // 不依赖 status（源驱动），避免 onStatus→setStatus 反馈环。
  useEffect(() => {
    const realSchema = initialMimic.data; // 真实图（演示场景下它就是空图）
    const topicList = isDemo ? [] : schemaTopics(realSchema);
    const source = isDemo
      ? createMockSource(mockSpecsFromSchema(DEMO_MIMIC))
      : createDataSource(realSchema, topicList, tier0Config);
    sourceRef.current = source;
    const offMsg = source.onMessage((m) => tagStore.setMessage(m.topic, m.payload));
    const offStatus = source.onStatus(setStatus);
    source.connect();
    // UNS 首帧：拉订阅 topic 当前值塞 tag-store（静态/低频指标不靠实时 MQTT 也能显示）。演示走 mock 不拉。
    let hydrated = true;
    if (!isDemo && topicList.length) {
      void readUnsFn({ data: { topics: topicList } })
        .then((r) => {
          if (!hydrated || !r.available) return;
          for (const v of r.values) {
            try { tagStore.setMessage(v.topic, JSON.parse(v.valueJson)); } catch { /* 跳过坏值 */ }
          }
        })
        .catch(() => { /* 忽略：UNS 不可用则纯靠 MQTT */ });
    }
    return () => {
      hydrated = false; // 防止已卸载的 effect 的 UNS 首帧回填写入新源
      offMsg();
      offStatus();
      source.disconnect();
      sourceRef.current = null;
      setStatus("disconnected"); // 断开/重建时复位状态（清理阶段，非渲染期同步 setState）
    };
  }, [tagStore, isDemo, initialMimic.data, tier0Config]);

  // §update —— schema 变更：增量更新数据源而不断连。
  // tier0 只对真正新增/移除的 topic 差量 subscribe/unsubscribe（仅新增 topic 拿 retain，已订阅不动）；
  // mock 热替换仿真 specs。改名/移动/调阈值/拖拽等不动 topic 的编辑 → 全程零订阅变化、零重连。
  useEffect(() => {
    sourceRef.current?.update(schema, schemaTopics(schema));
  }, [schema]);

  // 设备视觉状态：缺失节点兜底为 stale，避免 resolveNodeState(undefined)。
  // 未配置：图元有可绑定字段（契约）却一个都没绑 → 虚化提示「待接线」。
  const getState = (nodeId: string): NodeState => {
    const node = scene.byId[nodeId];
    if (!node) return { values: {}, running: false, fault: false, stale: true };
    const state = resolveNodeState(node, (t) => tagStore.getSnapshot().get(t));
    const cap = getCapability(node.type);
    // 设备配了动作按钮即算「已配置」（动作=写值，读绑定可选）
    if (cap && cap.states.length > 0 && Object.keys(node.bindings).length === 0 && !node.actions?.length) {
      return { ...state, unconfigured: true };
    }
    return state;
  };

  // 管线流动动画：暂时隐藏（防视觉疲劳）。置 true 即恢复按 flowBy 数据驱动的流向。
  const SHOW_FLOW = false;
  const isEdgeFlowing = (edge: MimicEdge) => SHOW_FLOW && resolveEdgeFlow(edge, (t) => tagStore.getSnapshot().get(t));
  const hasAnimation = () =>
    scene.nodes.some((n) => {
      const s = getState(n.id);
      // 故障闪 / 转动设备自转 / 储罐液面波动（有液位且数据新鲜——失联则冻结，不维持 rAF）。
      const hasLiquid = !s.stale && typeof s.values.level === "number" && s.values.level > 0;
      return s.fault || isSpinning(n.type, !!s.running) || hasLiquid;
    }) ||
    scene.edges.some((e) => isEdgeFlowing(e));

  // 检视面板仅在「恰好选中 1 个」时显示；多选只用于整组拖拽。
  const selectedNode = selectedIds.length === 1 ? scene.byId[selectedIds[0]] : null;
  // 键盘导航的单选游标。
  const cursorId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectOne = (id: string | null) => setSelectedIds(id ? [id] : []);

  // ── 设备动作按钮：编辑/预览两态点击均=执行（确认可选+按钮原位反馈）；配置入口在 Inspector，选中设备点本体 ──
  // 确认弹窗请求：点击时即快照动作内容（标题/按钮文案/消息组/反馈键），
  // 弹窗存活期 schema 变化不影响要发的内容，也免去 actions 非空断言与间接取值。
  const [confirmReq, setConfirmReq] = useState<{
    title: string;
    label: string;
    items: readonly PublishMessage[];
    feedbackKey: string;
  } | null>(null);
  const [overflowMenu, setOverflowMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  // 剪贴板（内存，本标签会话）+ 右键菜单状态。
  const [clipboard, setClipboard] = useState<readonly MimicNode[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; wx: number; wy: number; nodeId: string | null } | null>(null);
  const copyNodes = (ids: readonly string[]) => {
    const set = new Set(ids);
    const nodes = history.present.nodes.filter((n) => set.has(n.id));
    if (nodes.length) setClipboard(nodes);
  };
  const pasteAt = (wx: number, wy: number) => {
    if (!clipboard.length) return;
    const r = pasteNodes(history.present, clipboard, wx, wy);
    if (r.ids.length) { history.commit(r.mimic); setSelectedEdgeIds([]); setSelectedIds(r.ids); }
  };
  // sent 反馈：key=`${nodeId}:${index}`，1.5s 自动清除；进 redrawKey 驱动画布重绘
  const [sentKeys, setSentKeys] = useState<ReadonlySet<string>>(new Set());
  const sentTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => { for (const t of sentTimers.current.values()) clearTimeout(t); }, []);
  const flashSent = (key: string) => {
    setSentKeys((s) => new Set(s).add(key));
    const old = sentTimers.current.get(key);
    if (old) clearTimeout(old);
    sentTimers.current.set(key, setTimeout(() => {
      setSentKeys((s) => { const n = new Set(s); n.delete(key); return n; });
    }, 1500));
  };
  /** 逐条发布操作消息到 broker。不做本地回显——图元只反映 broker 回来的真实数据（无假显示）。 */
  const sendItems = (items: readonly PublishMessage[]) => publishMessages(sourceRef.current, items);
  const executeAction = (nodeId: string, actionIndex: number) => {
    const node = scene.byId[nodeId];
    const action = node?.actions?.[actionIndex];
    if (!node || !action) return;
    if (action.confirm) {
      setConfirmReq({
        title: node.label ?? node.id,
        label: action.label,
        items: action.items,
        feedbackKey: `${nodeId}:${actionIndex}`,
      });
      return;
    }
    sendItems(action.items);
    flashSent(`${nodeId}:${actionIndex}`);
  };
  // 菜单自身在点选后展示「成功」反馈并延时关闭（见 ActionOverflowMenu）；这里只管执行，不再抢先关闭。
  const pickOverflowAction = (nodeId: string, actionIndex: number) => {
    executeAction(nodeId, actionIndex);
  };
  const openOverflow = (nodeId: string, x: number, y: number) => setOverflowMenu({ nodeId, x, y });

  // 调色板拖放/点选在 (x,y) 新建图元，落库后自动选中直接配置。
  const addNewNode = (type: string, x: number, y: number) => {
    const { mimic, id } = addNode(schema, type, x, y);
    history.commit(mimic);
    setSelectedIds([id]);
  };

  // 操作配置弹窗（编辑模式）：入口统一在 Inspector「配置操作…」（画布点按钮仅选中设备开 Inspector）。配置本体在弹窗（用户评审决策）。
  const [actionsDialogId, setActionsDialogId] = useState<string | null>(null);
  // 历史数据查看器（只读，编辑/预览两态可用）：入口在 Inspector「查看历史数据」，本体为模态。
  const [historyNodeId, setHistoryNodeId] = useState<string | null>(null);

  // 删除当前选中：进历史栈可撤销，清空选择；被删节点的配置弹窗一并关闭。节点、连线可同时或分别选中，需一并处理。
  const deleteSelected = () => {
    if (selectedIds.length === 0 && selectedEdgeIds.length === 0) return;
    history.commit((s) => {
      const withoutEdges = selectedEdgeIds.reduce((m, id) => removeEdge(m, id), s);
      return selectedIds.length ? removeNodes(withoutEdges, selectedIds) : withoutEdges;
    });
    if (actionsDialogId && selectedIds.includes(actionsDialogId)) setActionsDialogId(null);
    setSelectedIds([]);
    setSelectedEdgeIds([]);
  };

  // 键盘导航：方向键/Home/End 在节点间循环移动选择，Escape 取消，Del 删除选中（节点或连线）。
  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === "Escape") {
      if (selectedIds.length) setSelectedIds([]);
      if (selectedEdgeIds.length) setSelectedEdgeIds([]);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && (selectedIds.length || selectedEdgeIds.length) && editing) {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault(); // 全选所有元件（配合整体移动/删除）
      setSelectedEdgeIds([]);
      setSelectedIds(scene.nodes.map((n) => n.id));
      return;
    }
    if (editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedIds.length) {
      e.preventDefault(); // 复制选中元件（偏移 30px、自动新位号；不带连线）
      const dup = duplicateNodes(history.present, selectedIds, 30, 30);
      if (dup.ids.length) { history.commit(dup.mimic); setSelectedIds(dup.ids); }
      return;
    }
    if (editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && selectedIds.length) {
      e.preventDefault(); // 复制到剪贴板
      copyNodes(selectedIds);
      return;
    }
    if (editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && clipboard.length) {
      e.preventDefault(); // 键盘粘贴：相对原位 +30 偏移
      const minX = Math.min(...clipboard.map((n) => n.x));
      const minY = Math.min(...clipboard.map((n) => n.y));
      pasteAt(minX + 30, minY + 30);
      return;
    }
    let nextId: string | null | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextId = stepSelection(scene.nodes, cursorId, 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextId = stepSelection(scene.nodes, cursorId, -1);
    else if (e.key === "Home") nextId = scene.nodes[0]?.id ?? null;
    else if (e.key === "End") nextId = scene.nodes[scene.nodes.length - 1]?.id ?? null;
    else return;
    e.preventDefault(); // 阻止方向键滚动页面
    if (nextId !== undefined) selectOne(nextId);
  };

  // 撤销/重做全局快捷键：Ctrl/Cmd+Z 撤销、+Shift+Z 或 +Y 重做。输入框内不拦截（留给原生）。
  const { undo: undoHistory, redo: redoHistory } = history;
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el?.tagName) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!editing || isTyping(e.target) || !(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undoHistory();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redoHistory();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoHistory, redoHistory, editing]);
  const selectionAnnounce =
    selectedIds.length > 1
      ? t("已选 {n} 个设备", { n: selectedIds.length })
      : describeSelection(selectedNode, selectedNode ? getState(selectedNode.id) : null);

  // 选中 / 语言 / 按钮 sent 反馈 变化进重绘键（语言影响画布内联文字，sent 影响按钮视觉态）。
  const redrawKey = `${selectedIds.join(",")}|${selectedEdgeIds.join(",")}|${lang}|${[...sentKeys].join(",")}`;

  return (
    <div
      ref={rootRef}
      data-hmi-theme={themeMode}
      className="flex h-screen flex-col overflow-hidden bg-background text-foreground"
    >
      <Topbar
        title={schema.meta.name}
        mimicSwitcher={
          editing ? (
            <MimicTitle name={schema.meta.name} onRename={(n) => history.commit((s) => setMimicName(s, n))} />
          ) : undefined
        }
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setActionsDialogId(null); // 切模式关掉配置弹窗（预览不该见编辑面）
        }}
        canSwitchMode={canEdit}
        demoAvailable={demoAvailable}
        status={status}
        brokerUrl={tier0Config?.mqttHost || "dev (mock)"}
        sourceKind={dataSourceKind(isDemo, tier0Config)}
      />
      {showWarnings ? (
        <div
          className="flex shrink-0 items-start gap-2 border-b border-state-paused-border bg-state-paused-bg px-3 py-1.5 text-xs text-state-paused-fg"
          data-testid="schema-warnings"
        >
          <span className="mt-px shrink-0 font-semibold">{t("schema 提示（{n}）：", { n: schemaWarnings.length })}</span>
          <span className="min-w-0 flex-1">
            {schemaWarnings.slice(0, 3).join("；")}
            {schemaWarnings.length > 3 ? ` ${t("…等 {n} 条", { n: schemaWarnings.length })}` : ""}
          </span>
          <button type="button" onClick={() => setDismissedSchema(schema)} className="shrink-0 font-medium hover:underline">
            {t("忽略")}
          </button>
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1" style={{ backgroundColor: palette.canvas }} data-edge-count={scene.edges.length}>
          <HmiCanvas
            ref={canvasRef}
            scene={scene}
            registry={registry}
            palette={palette}
            getState={getState}
            selectedIds={selectedIds}
            isEdgeFlowing={isEdgeFlowing}
            hasAnimation={hasAnimation}
            subscribeData={tagStore.subscribe}
            onSelect={selectOne}
            onActionClick={executeAction}
            onActionOverflow={openOverflow}
            onContextMenu={editing ? (cx, cy, wx, wy, nodeId) => {
              if (nodeId && !selectedIds.includes(nodeId)) { setSelectedEdgeIds([]); setSelectedIds([nodeId]); }
              setContextMenu({ x: cx, y: cy, wx, wy, nodeId });
            } : undefined}
            getActionFeedback={(nodeId, i) => sentKeys.has(`${nodeId}:${i}`)}
            onSelectMany={setSelectedIds}
            onSelectManyEdges={editing ? setSelectedEdgeIds : undefined}
            onSelectionDrag={editing ? (nodeIds, edgeIds, dx, dy) => history.replace((s) => moveSelectionBy(s, nodeIds, edgeIds, dx, dy)) : undefined}
            onNodesDragStart={editing ? history.begin : undefined}
            onCancelDrag={editing ? history.cancel : undefined}
            onResizeNode={editing ? (id, sizeX, sizeY) => history.replace((s) => setNodeSize(s, id, sizeX, sizeY)) : undefined}
            tool={editing ? tool : "pan"}
            onAddNode={editing ? addNewNode : undefined}
            onPlaceLine={editing ? (kind, x, y) => {
              const a: [number, number] = [x - 60, y];
              const b: [number, number] = [x + 60, y];
              history.commit((s) => addEdgeEnds(s, { point: a }, { point: b }, [a, b], kind === "lead"));
            } : undefined}
            onAddEdge={editing ? (from, to, points, sides) => {
              // 仪表（ISA 气泡）连线自动用虚线引线（测量/控制信号，区别于工艺管线）
              const isSignal = (id: string) => scene.byId[id]?.type === "instrument";
              const lead = isSignal(from) || isSignal(to);
              history.commit((s) => addEdge(s, from, to, points, sides, lead));
            } : undefined}
            onAddEdgePoint={editing ? (fromId, fromSide, point) => {
              const isSignal = scene.byId[fromId]?.type === "instrument";
              // 自由端点边：用 addEdgeEnds（from=节点+方位，to=自由点）。引线判定只看源（仪表）。
              history.commit((s) => addEdgeEnds(s, { node: fromId, side: fromSide }, { point }, [
                [scene.byId[fromId]?.x ?? point[0], scene.byId[fromId]?.y ?? point[1]],
                point,
              ], isSignal));
            } : undefined}
            selectedEdgeIds={selectedEdgeIds}
            onSelectEdge={editing ? (id) => setSelectedEdgeIds(id ? [id] : []) : undefined}
            onSetEdgeEnd={editing ? (edgeId, which, end, commit) =>
              (commit ? history.commit : history.replace)((s) => setEdgeEnd(s, edgeId, which, end))
            : undefined}
            onKeyDown={handleCanvasKeyDown}
            ariaLabel={`${t("工艺流程图，方向键在设备间移动，Esc 取消选择。")}${selectionAnnounce}`}
            redrawKey={redrawKey}
          />
          {editing ? (
            <PalettePanel
              registry={registry}
              palette={palette}
              onPlace={(type) => canvasRef.current?.placeAtCenter(type)}
              onPlaceLine={(kind) => canvasRef.current?.placeLineAtCenter(kind)}
            />
          ) : null}
          {editing && selectedIds.length >= 2 ? (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
              <div className="pointer-events-auto">
                <SelectionBar count={selectedIds.length} onDelete={deleteSelected} onClear={() => setSelectedIds([])} />
              </div>
            </div>
          ) : null}
          {/* 实线/虚线由两端类型自动决定（连仪表=虚线引线，否则实线管道），不再提供手动切换。 */}
          {/* 全局告警汇总（两态都显示，operator 监控核心）：点条目选中并居中那台设备 */}
          <div className="pointer-events-none absolute right-3 top-3">
            <div className="pointer-events-auto">
              <AlarmStrip
                alarms={activeAlarms(scene.nodes, getState)}
                onSelect={(nodeId) => {
                  setSelectedIds([nodeId]);
                  const n = scene.byId[nodeId];
                  if (n) canvasRef.current?.centerOn(n.x, n.y);
                }}
              />
            </div>
          </div>
          {editing ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
              <div className="pointer-events-auto">
                <EditToolbar
                  tool={tool}
                  onToolChange={setTool}
                  canUndo={history.canUndo}
                  canRedo={history.canRedo}
                  onUndo={history.undo}
                  onRedo={history.redo}
                  selectedCount={selectedIds.length + selectedEdgeIds.length}
                  onDelete={deleteSelected}
                  onSave={async () => {
                    if (demoEdit) await saveDemoFn({ data: { data: schema } }); // 演示编辑：写回 demo-mimic.json
                    else await saveMimicFn({ data: { id: initialMimic.id, data: schema } });
                  }}
                />
              </div>
            </div>
          ) : null}
          <div className="pointer-events-none absolute bottom-3 left-3">
            <div className="pointer-events-auto">
              <StateLegend theme={palette} registry={registry} />
            </div>
          </div>
        </div>
        {selectedNode ? (
          <>
            {/* 窄屏：半透明遮罩，点击关闭检视（宽屏隐藏，检视为常驻侧栏） */}
            <div className="absolute inset-0 z-10 bg-black/20 md:hidden" onClick={() => setSelectedIds([])} aria-hidden />
            <Inspector
              key={selectedNode.id}
              readOnly={!editing}
              node={selectedNode}
              state={getState(selectedNode.id)}
              capability={getCapability(selectedNode.type)}
              registry={registry}
              palette={palette}
              getPayload={(t) => snapshot.get(t)}
              onClose={() => setSelectedIds([])}
              onDelete={deleteSelected}
              onSetBinding={(field, binding) => history.commit((s) => setNodeBinding(s, selectedNode.id, field, binding))}
              onSetLabel={(label) => history.commit((s) => setNodeLabel(s, selectedNode.id, label))}
              onSetRotation={(deg) => history.commit((s) => setNodeRotation(s, selectedNode.id, deg))}
              onSetSize={(size) => history.commit((s) => setNodeSize(s, selectedNode.id, size))}
              onAddTopic={(topic) => history.commit((s) => addNodeTopic(s, selectedNode.id, topic))}
              onRemoveTopic={(topic) => history.commit((s) => removeNodeTopic(s, selectedNode.id, topic))}
              onAddWatch={(watch) => history.commit((s) => addNodeWatch(s, selectedNode.id, watch))}
              onRemoveWatch={(index) => history.commit((s) => removeNodeWatch(s, selectedNode.id, index))}
              onUpdateWatch={(index, patch) => history.commit((s) => updateNodeWatch(s, selectedNode.id, index, patch))}
              onSetProp={editing ? (key, value) => history.commit((s) => setNodeProp(s, selectedNode.id, key, value)) : undefined}
              onConfigureActions={() => setActionsDialogId(selectedNode.id)}
              onViewHistory={() => setHistoryNodeId(selectedNode.id)}
            />
          </>
        ) : null}
      </div>
      {actionsDialogId && editing ? (() => {
        const dialogNode = scene.byId[actionsDialogId];
        return dialogNode ? (
          <ActionsDialog
            node={dialogNode}
            onSetActions={(actions) =>
              history.commit((s) => {
                // 幂等：与 schema 现值相同（如失焦但没改）直接返回原引用 → useHistory 跳过，不刷 undo 栈
                const cur = s.nodes.find((n) => n.id === actionsDialogId)?.actions;
                if (JSON.stringify(cur ?? null) === JSON.stringify(actions ?? null)) return s;
                return setNodeActions(s, actionsDialogId, actions);
              })
            }
            onTestSend={sendItems}
            onClose={() => setActionsDialogId(null)}
          />
        ) : null;
      })() : null}
      {historyNodeId ? (() => {
        const histNode = scene.byId[historyNodeId];
        return histNode ? <HistoryDialog node={histNode} onClose={() => setHistoryNodeId(null)} /> : null;
      })() : null}
      {confirmReq ? (
        <ControlDialog
          request={{
            kind: "confirm",
            title: confirmReq.title,
            message: t("将发送 {n} 条消息，确认执行？", { n: confirmReq.items.length }),
            confirmLabel: confirmReq.label,
          }}
          onConfirm={() => {
            const r = confirmReq;
            setConfirmReq(null);
            sendItems(r.items);
            flashSent(r.feedbackKey);
          }}
          onCancel={() => setConfirmReq(null)}
        />
      ) : null}
      {overflowMenu ? (() => {
        const menu = overflowMenu;
        const n = scene.byId[menu.nodeId];
        const all = n?.actions ?? [];
        const { overflow } = splitActions(all.length);
        return overflow.length > 0 ? (
          <ActionOverflowMenu
            actions={overflow.map((i) => all[i])}
            startIndex={overflow[0]}
            anchorX={menu.x}
            anchorY={menu.y}
            onPick={(i) => pickOverflowAction(menu.nodeId, i)}
            onClose={() => setOverflowMenu(null)}
          />
        ) : null;
      })() : null}
      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.nodeId
            ? [
                { label: t("复制"), onClick: () => copyNodes(selectedIds.length ? selectedIds : [contextMenu.nodeId!]) },
                { label: t("删除"), onClick: () => { const ids = selectedIds.length ? selectedIds : [contextMenu.nodeId!]; history.commit((s) => removeNodes(s, ids)); setSelectedIds([]); } },
              ]
            : [
                { label: t("粘贴"), onClick: () => pasteAt(contextMenu.wx, contextMenu.wy), disabled: clipboard.length === 0 },
              ]}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      {/* 屏幕阅读器播报当前选中设备（视觉隐藏） */}
      <div className="sr-only" role="status" aria-live="polite" data-testid="selection-live">
        {selectionAnnounce}
      </div>
    </div>
  );
}
