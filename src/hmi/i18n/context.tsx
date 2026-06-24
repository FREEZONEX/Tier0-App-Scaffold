"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { translate, type Lang, type TParams } from "./translate";

interface I18nValue {
  readonly lang: Lang;
  readonly setLang: (l: Lang) => void;
  /** 翻译：以中文原文为 key，可带 {placeholder} 插值。 */
  readonly t: (zh: string, params?: TParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * initialLang 来自 SSR（按 Accept-Language 探测）：语言完全由请求环境决定（切换入口已隐藏）。
 * 不再读写 localStorage——否则历史偏好会卡死语言且没有界面可改回。
 * setLang 保留供程序化切换（当前无调用方）。
 */
export function I18nProvider({ children, initialLang = "zh" }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (zh, params) => translate(zh, lang, params) }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n 必须在 <I18nProvider> 内使用");
  return ctx;
}

/** 便捷：只取翻译函数。 */
export function useT(): I18nValue["t"] {
  return useI18n().t;
}
