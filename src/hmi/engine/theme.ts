export interface Palette {
  readonly canvas: string;
  readonly stroke: string;
  readonly fillLight: string;
  readonly fillDeep: string;
  readonly liquid: string;
  readonly text: string;
  readonly textMuted: string;
  readonly alarm: string;
  readonly running: string;
  readonly interlock: string;
  readonly selection: string;
  readonly stale: string;
  /** 拖动节点时的对齐参考线色（Figma 式醒目提示，区别于选中青）。 */
  readonly guide: string;
  /** 角标前景（锁体/字母）：叠在饱和角标底色上的近白前景。 */
  readonly badgeFg: string;
  /** 动作按钮点击成功反馈色（Tier0 设计系统 Primary/Green/500）：与设备运行态 running 语义不同，不复用。 */
  readonly actionSuccess: string;
}

export type ThemeMode = "light" | "dark";

export const PALETTES: Record<ThemeMode, Palette> = {
  light: {
    canvas: "#d4d7da", stroke: "#545960", fillLight: "#eef0f2", fillDeep: "#6b7178",
    liquid: "#8fa0ad", text: "#2b2e33", textMuted: "#6c7178",
    alarm: "#b0473d", running: "#4a9d6f", interlock: "#b58a2e", selection: "#2f8f83", stale: "#aeb3b8",
    guide: "#e93d82", badgeFg: "#ffffff", actionSuccess: "#b2ed1d",
  },
  dark: {
    canvas: "#20242a", stroke: "#8b929b", fillLight: "#2f353d", fillDeep: "#9aa1aa",
    liquid: "#43525f", text: "#d4d8dc", textMuted: "#868d95",
    alarm: "#db6a5d", running: "#5cb585", interlock: "#c59a3a", selection: "#3aa597", stale: "#5a626b",
    guide: "#e93d82", badgeFg: "#f2f4f6", actionSuccess: "#b2ed1d",
  },
};

export function getPalette(mode: ThemeMode): Palette {
  return PALETTES[mode];
}

/** Palette 角色 → globals.css CSS 变量名。 */
const CSS_VAR: Record<keyof Palette, string> = {
  canvas: "--hmi-canvas",
  stroke: "--hmi-stroke",
  fillLight: "--hmi-fill-light",
  fillDeep: "--hmi-fill-deep",
  liquid: "--hmi-liquid",
  text: "--hmi-text",
  textMuted: "--hmi-text-muted",
  alarm: "--hmi-alarm",
  running: "--hmi-running",
  interlock: "--hmi-interlock",
  selection: "--hmi-selection",
  stale: "--hmi-stale",
  guide: "--hmi-guide",
  badgeFg: "--hmi-badge-fg",
  actionSuccess: "--hmi-action-success",
};

/**
 * 从 CSS 变量读取调色板（getVar 注入，便于测试 / 从 getComputedStyle 读取）。
 * 任一角色变量为空则回落到硬编码 PALETTES[mode]，保证永远拿到完整调色板。
 */
export function readPalette(getVar: (name: string) => string, mode: ThemeMode): Palette {
  const fallback = PALETTES[mode];
  const out: Record<keyof Palette, string> = { ...fallback };
  for (const role of Object.keys(CSS_VAR) as (keyof Palette)[]) {
    const value = getVar(CSS_VAR[role]).trim();
    if (value) out[role] = value;
  }
  return out;
}
