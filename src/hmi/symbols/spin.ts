/**
 * 转动设备的「运行自转」契约。
 *
 * 运行态转动设备（泵叶轮 / 风机叶片 / 搅拌桨）在 build 时把转动件包进
 * `{ kind: "rotate", spinPeriod }` 图元，painter 按 timeMs 持续旋转。
 * `isSpinning` 同时驱动 `HmiPage.hasAnimation`（让 rAF 循环在有自转时持续重绘）
 * 与判断图元该不该包 rotate —— 单点定义，两处共用避免漂移。
 */

/** 主体转动件会自转的图元类型（running 时）。仅面视转动件——风机叶轮、空冷器顶置轴流扇。
 *  泵按 OpenBridge 风格用静态流向三角（不自转）；搅拌器等竖轴侧视件 2D 旋转会失真，均不纳入。 */
export const SPIN_TYPES: ReadonlySet<string> = new Set(["fan", "cooler"]);

/** 自转一圈周期（ms）；越小越快。叶轮取偏快，读起来「在转」但不晃眼。 */
export const SPIN_PERIOD_MS = 1400;

/** 该节点此刻是否在自转：转动类型 + 运行中。 */
export const isSpinning = (type: string, running: boolean): boolean =>
  running && SPIN_TYPES.has(type);
