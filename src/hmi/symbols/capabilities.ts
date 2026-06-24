/**
 * 图元能力 / 状态契约（单一真相源）。
 *
 * 设计前提：image→AI→schema 只产「拓扑」（设备类型/位置/连线），不含运行态；
 * 设备的 open/running/level… 由后续「数据绑定」步骤把字段绑到 MQTT topic，运行时驱动。
 * 本清单显式声明每类图元「可绑定哪些状态字段、各自语义与视觉」，供：
 *   1) 预览页（按契约展示每类状态）
 *   2) schema 校验（未知 binding key 告警，后配防拼错）
 *   3) AI 映射文档（docs/ai-image-to-schema.md）
 * 三处统一引用，避免约定散落。
 */

export type FieldKind = "boolean" | "number";

export interface StateField {
  /** bindings 里的 key（= 绑定字段名）。 */
  readonly key: string;
  readonly kind: FieldKind;
  /** 人读说明（含真/假语义或量纲）。 */
  readonly label: string;
  /** 视觉效果（这个字段如何影响图元外观）。 */
  readonly effect: string;
  /** 数值字段单位（可选）。 */
  readonly unit?: string;
}

export interface PropSpec {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind | "string";
}

export type SymbolCategory = "设备" | "容器" | "换热" | "仪表" | "执行器" | "端子";

export interface Capability {
  readonly type: string;
  readonly label: string;
  readonly category: SymbolCategory;
  readonly desc: string;
  /** 该类型可绑定的状态字段。 */
  readonly states: readonly StateField[];
  /** 静态配置项（非绑定，schema node.props）。 */
  readonly props?: readonly PropSpec[];
}

export const CAPABILITIES: Readonly<Record<string, Capability>> = {
  tank: { type: "tank", label: "储罐 Tank", category: "容器", desc: "锥顶平底储罐，液位填充",
    states: [{ key: "level", kind: "number", label: "液位 0–100", effect: "液面高度", unit: "%" }] },
  vessel: { type: "vessel", label: "立式容器 Vessel", category: "容器", desc: "反应釜(搅拌)/接收罐，封头曲面 + 夹套",
    states: [{ key: "level", kind: "number", label: "液位 0–100", effect: "液面高度", unit: "%" }, { key: "running", kind: "boolean", label: "搅拌运行", effect: "搅拌电机深填充" }],
    props: [{ key: "agitator", label: "是否带顶置搅拌器", kind: "boolean" }] },
  pump: { type: "pump", label: "泵 Pump", category: "设备", desc: "离心泵（切向出口）",
    states: [{ key: "running", kind: "boolean", label: "运行/停止", effect: "运行=深填充·醒目" }, { key: "rpm", kind: "number", label: "转速", effect: "内联显示", unit: "rpm" }] },
  motor: { type: "motor", label: "电机 Motor", category: "设备", desc: "电机 + 轴 + 接线箱",
    states: [{ key: "running", kind: "boolean", label: "运行/停止", effect: "运行=深填充" }, { key: "rpm", kind: "number", label: "转速", effect: "内联显示", unit: "rpm" }] },
  fan: { type: "fan", label: "风机 Fan", category: "设备", desc: "蜗壳风机",
    states: [{ key: "running", kind: "boolean", label: "运行/停止", effect: "运行=深填充" }, { key: "rpm", kind: "number", label: "转速", effect: "内联显示", unit: "rpm" }] },
  valve: { type: "valve", label: "阀门 Valve", category: "执行器", desc: "蝶形闸阀，开/关",
    states: [{ key: "open", kind: "boolean", label: "开/关", effect: "开=深填充·通路；关=浅填充·阻断" }] },
  damper: { type: "damper", label: "风门 Damper", category: "执行器", desc: "风道风门，叶片角度示开/关",
    states: [{ key: "open", kind: "boolean", label: "开/关", effect: "开=横叶低阻；关=斜叶阻断" }] },
  switch: { type: "switch", label: "开关 Switch", category: "执行器", desc: "电气刀闸，刀片角度连续示开合度",
    states: [{ key: "opening", kind: "number", label: "开合度 0–100", effect: "100=闭合平直通路·0=断开抬角", unit: "%" }] },
  meter: { type: "meter", label: "流量计 Meter", category: "仪表", desc: "在线流量计",
    states: [{ key: "flow", kind: "number", label: "流量", effect: "内联显示", unit: "m³/h" }] },
  filter: { type: "filter", label: "过滤器 Filter", category: "设备", desc: "过滤器，压差监测",
    states: [{ key: "dp", kind: "number", label: "压差", effect: "内联显示", unit: "kPa" }] },
  exchanger: { type: "exchanger", label: "换热器 Exchanger", category: "换热", desc: "管壳式换热器 (TEMA)",
    states: [{ key: "temp", kind: "number", label: "温度", effect: "内联显示", unit: "°C" }] },
  condenser: { type: "condenser", label: "冷凝器 Condenser", category: "换热", desc: "立式冷凝器",
    states: [{ key: "temp", kind: "number", label: "温度", effect: "内联显示", unit: "°C" }] },
  cooler: { type: "cooler", label: "空冷器 Cooler", category: "换热", desc: "管束 + 风道空冷器",
    states: [{ key: "running", kind: "boolean", label: "风机运行", effect: "运行=深填充" }, { key: "temp", kind: "number", label: "温度", effect: "内联显示", unit: "°C" }] },
  dialgauge: { type: "dialgauge", label: "表盘仪表 Dial gauge", category: "仪表", desc: "表盘指示仪表",
    states: [{ key: "value", kind: "number", label: "读数 0–100", effect: "指针角度", unit: "%" }],
    props: [{ key: "face", label: "面板字母（如 P/T/ΔP）", kind: "string" }] },
  bargauge: { type: "bargauge", label: "条形仪表 Bar gauge", category: "仪表", desc: "竖条填充仪表",
    states: [{ key: "value", kind: "number", label: "读数 0–100", effect: "竖条填充高度", unit: "%" }] },

  column: { type: "column", label: "精馏塔 Column", category: "容器", desc: "立式塔器，塔盘内件 + 塔釜液位",
    states: [{ key: "level", kind: "number", label: "塔釜液位 0–100", effect: "塔釜液面高度", unit: "%" }, { key: "temp", kind: "number", label: "温度", effect: "内联显示", unit: "°C" }] },
  drum: { type: "drum", label: "卧式分离罐 Drum", category: "容器", desc: "卧式缓冲罐/分离器，底部液位",
    states: [{ key: "level", kind: "number", label: "液位 0–100", effect: "液面高度", unit: "%" }] },
  silo: { type: "silo", label: "料仓 Silo", category: "容器", desc: "固体储料仓 + 锥斗",
    states: [{ key: "level", kind: "number", label: "料位 0–100", effect: "料位高度", unit: "%" }] },
  compressor: { type: "compressor", label: "压缩机 Compressor", category: "设备", desc: "旋转压缩机（楔形机壳）",
    states: [{ key: "running", kind: "boolean", label: "运行/停止", effect: "运行=深填充" }, { key: "rpm", kind: "number", label: "转速", effect: "内联显示", unit: "rpm" }] },
  heater: { type: "heater", label: "加热器 Heater", category: "换热", desc: "带加热盘管的加热器",
    states: [{ key: "running", kind: "boolean", label: "运行/停止", effect: "运行=深填充" }, { key: "temp", kind: "number", label: "温度", effect: "内联显示", unit: "°C" }] },
  controlvalve: { type: "controlvalve", label: "调节阀 Control valve", category: "执行器", desc: "带膜头执行器的连续调节阀",
    states: [{ key: "opening", kind: "number", label: "开度 0–100", effect: ">0=深填充·通路", unit: "%" }] },
  checkvalve: { type: "checkvalve", label: "止回阀 Check valve", category: "执行器", desc: "单向止回阀（方向箭头）",
    states: [{ key: "open", kind: "boolean", label: "通流/截止", effect: "通流=深填充箭头" }] },
  safetyvalve: { type: "safetyvalve", label: "安全阀 Safety valve", category: "执行器", desc: "角式泄压阀（上出口+弹簧）",
    states: [{ key: "open", kind: "boolean", label: "起跳/关闭", effect: "起跳=深填充" }] },
  instrument: { type: "instrument", label: "ISA 仪表 Instrument", category: "仪表", desc: "ISA 仪表，默认 DCS 数据框(位号+值)；display=bubble 切回 ISA 圆气泡",
    states: [{ key: "value", kind: "number", label: "读数", effect: "内联显示" }],
    props: [{ key: "tag", label: "位号文字（如 FT/LT/PT）", kind: "string" }, { key: "display", label: "样式：box(DCS 方框，默认)/bubble(ISA 圆气泡)", kind: "string" }] },

  cyclone: { type: "cyclone", label: "旋风分离器 Cyclone", category: "容器", desc: "旋风分离器（短圆柱 + 长锥体）",
    states: [{ key: "level", kind: "number", label: "料位 0–100", effect: "料位高度", unit: "%" }] },
  mixer: { type: "mixer", label: "静态混合器 Mixer", category: "设备", desc: "管段静态混合器（交叉混合元件）",
    states: [] },
  agitator: { type: "agitator", label: "搅拌器 Agitator", category: "设备", desc: "顶置搅拌器（电机 + 轴 + 桨叶）",
    states: [{ key: "running", kind: "boolean", label: "运行/停止", effect: "运行=深填充" }, { key: "rpm", kind: "number", label: "转速", effect: "内联显示", unit: "rpm" }] },
  terminal: { type: "terminal", label: "出入口端子 Terminal", category: "端子", desc: "工艺边界端子（进料/产品/放空/公用工程），指向料流方向",
    states: [{ key: "flow", kind: "number", label: "流量", effect: "内联显示", unit: "t/h" }] },
  readout: { type: "readout", label: "数值点 Readout", category: "仪表", desc: "自由摆放的数值标注，绑一个数值叠在设备/管线上做精确多点位标记（如塔各塔盘温度）",
    states: [{ key: "value", kind: "number", label: "数值", effect: "盒内居中显示（越限变色）" }] },
};

export const ALL_CAPABILITIES: readonly Capability[] = Object.values(CAPABILITIES);

export function getCapability(type: string): Capability | undefined {
  return CAPABILITIES[type];
}

/** 某类型可接受的 binding key 集合（含通用 stale 由系统派生，不在此列）。 */
export function bindableKeys(type: string): ReadonlySet<string> {
  return new Set((CAPABILITIES[type]?.states ?? []).map((s) => s.key));
}
