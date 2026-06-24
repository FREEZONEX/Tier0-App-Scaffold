import { EN } from "./dict";

export type Lang = "zh" | "en";

export type TParams = Record<string, string | number>;

/** 占位插值：把 "{n}" 替换为 params.n。无 params 原样返回。 */
function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/**
 * 纯翻译：以中文原文为 key（zh-as-key）。
 * - zh：原样返回（中文恒可用，缺词典条目也不破）
 * - en：查英文词典，缺失回退中文（优雅降级，永不出现空串）
 * 供 React(useT) 与画布/纯函数（传 lang）共用同一词典。
 */
export function translate(zh: string, lang: Lang, params?: TParams): string {
  const out = lang === "en" ? (EN[zh] ?? zh) : zh;
  return interpolate(out, params);
}

/**
 * 按 HTTP `Accept-Language` 决定初始语言（SSR 用，依实时环境而非硬编码）。
 * 取首个语言标签：en 开头 → en，其余（含 zh、空、缺失）→ zh。
 */
export function pickLang(acceptLanguage: string | null | undefined): Lang {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : "zh";
}

// ── 画布当前语言（画布在 React 外渲染，读此模块级值；React 侧 lang 变化时同步并触发重绘）──
let _canvasLang: Lang = "zh";
export function setCanvasLang(l: Lang): void {
  _canvasLang = l;
}
export function getCanvasLang(): Lang {
  return _canvasLang;
}
