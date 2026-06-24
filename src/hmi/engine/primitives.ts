export interface Style {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dash?: readonly number[];
  readonly opacity?: number;
  readonly font?: string;
  readonly textAlign?: "left" | "center" | "right";
  readonly lineCap?: "butt" | "round";
  /** 文本衬底反白：先用此色粗描边再填充，管线/图形从文字底下穿过时保持可读。 */
  readonly halo?: string;
  /** 报警慢闪：painter 按相位调制透明度。 */
  readonly blink?: boolean;
}

/** path 指令：M/L 直线、Q/C 贝塞尔、A 圆弧（canvas arc 语义）。 */
export type PathCmd =
  | { readonly c: "M"; readonly x: number; readonly y: number }
  | { readonly c: "L"; readonly x: number; readonly y: number }
  | { readonly c: "Q"; readonly x1: number; readonly y1: number; readonly x: number; readonly y: number }
  | { readonly c: "C"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly x: number; readonly y: number }
  | { readonly c: "A"; readonly cx: number; readonly cy: number; readonly r: number; readonly a0: number; readonly a1: number; readonly ccw?: boolean };

export type Primitive =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly r?: number; readonly style: Style }
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number; readonly style: Style }
  | { readonly kind: "line"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly style: Style; readonly flow?: boolean }
  | { readonly kind: "polyline"; readonly points: readonly (readonly [number, number])[]; readonly style: Style; readonly flow?: boolean }
  | { readonly kind: "polygon"; readonly points: readonly (readonly [number, number])[]; readonly style: Style }
  /** 曲线路径（封头椭圆弧/蜗壳螺线等）：按指令序列描线，close 后可填充。 */
  | { readonly kind: "path"; readonly d: readonly PathCmd[]; readonly close?: boolean; readonly style: Style }
  | { readonly kind: "text"; readonly x: number; readonly y: number; readonly text: string; readonly style: Style }
  /** 裁剪组：把 children 限制在 (x,y,w,h,r) 圆角矩形区域内绘制（如液位裁到罐体圆角内）。 */
  | { readonly kind: "clip"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly r?: number; readonly children: readonly Primitive[] }
  /** 液面波动填充：从顶边（y）按正弦起伏向下填到 y+h。amp 振幅、wavelength 波长、period 周期(ms)。
   *  painter 按 timeMs 取相位（period>0 时持续流动；与 blink/flow/spin 同款时间相位）。
   *  顶边均值恒为 y → 液位读数不受波动影响。失联态由上层改回静态 rect（冻结）。 */
  | { readonly kind: "wave"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly amp: number; readonly wavelength: number; readonly period: number; readonly style: Style }
  /** 旋转组：把 children 绕锚点 (cx,cy) 旋转 deg 度后绘制（图元朝向，如竖装泵/阀）。
   *  给 spinPeriod（ms/圈）则在 deg 基础上按 timeMs 持续自转——运行态转动设备（泵叶轮/风机叶片/搅拌桨）。 */
  | { readonly kind: "rotate"; readonly cx: number; readonly cy: number; readonly deg: number; readonly children: readonly Primitive[]; readonly spinPeriod?: number }
  /** 缩放组：把 children 绕锚点 (cx,cy) 各轴 (sx,sy) 缩放后绘制（图元等比放大/缩小；线宽随之变粗细，视觉自洽）。 */
  | { readonly kind: "scale"; readonly cx: number; readonly cy: number; readonly sx: number; readonly sy: number; readonly children: readonly Primitive[] };
