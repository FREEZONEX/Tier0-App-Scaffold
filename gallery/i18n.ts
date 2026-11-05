export type GalleryLocale = "zh-CN" | "en";
export type GalleryTheme = "light" | "dark";

const LOCALE_KEY = "tier0-gallery-locale";
const THEME_KEY = "tier0-gallery-theme";

export function readLocale(): GalleryLocale {
  try {
    const value = localStorage.getItem(LOCALE_KEY);
    if (value === "en" || value === "zh-CN") return value;
  } catch {
    /* ignore */
  }
  return "zh-CN";
}

export function writeLocale(locale: GalleryLocale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = locale;
}

export function readTheme(): GalleryTheme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function writeTheme(theme: GalleryTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  // Paint canvas immediately so search/inputs never flash the opposite theme fill.
  root.style.backgroundColor = theme === "dark" ? "#0c0d0f" : "#ffffff";
  if (document.body) {
    document.body.style.backgroundColor = theme === "dark" ? "#0c0d0f" : "";
  }
  // Sync same-origin preview iframes without reload (avoids white flash).
  document.querySelectorAll("iframe").forEach((node) => {
    const frame = node as HTMLIFrameElement;
    try {
      const doc = frame.contentDocument;
      if (!doc?.documentElement) return;
      doc.documentElement.classList.toggle("dark", theme === "dark");
      doc.documentElement.style.colorScheme = theme;
    } catch {
      /* cross-origin — ignore */
    }
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
  });
}

export function applyGalleryPrefs(locale: GalleryLocale, theme: GalleryTheme) {
  writeLocale(locale);
  writeTheme(theme);
}

/** Apply current theme to a just-loaded preview frame. */
export function syncFrameTheme(frame: HTMLIFrameElement, theme: GalleryTheme) {
  try {
    const root = frame.contentDocument?.documentElement;
    if (!root) return;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch {
    /* ignore */
  }
}

const CATEGORY_EN: Record<string, string> = {
  all: "All components",
  business: "Business scenes",
  通用: "General",
  布局: "Layout",
  导航: "Navigation",
  数据录入: "Data entry",
  数据展示: "Data display",
  反馈: "Feedback",
  高级组件: "Advanced",
  重型组件: "Heavy",
  验收: "Review",
  组件: "Components",
};

export const chrome = {
  "zh-CN": {
    portal: "Tier0 组件门户",
    filterNav: "搜索分类、组件或说明",
    filterPlaceholder: "搜索分类、组件或说明…",
    review: "验收",
    components: "组件",
    allComponents: "全部组件",
    business: "业务场景",
    titleComponents: "Tier0 组件",
    leadComponents: (n: number, cats: number) =>
      `${n} 个组件，${cats} 个分类（含重型组件）。基于同一套 Tier0 设计令牌。`,
    leadBusiness: (n: number) =>
      `${n} 个业务场景，含应用侧边栏与工作台副栏，对照真实工作流验收。`,
    scenesUnit: "个场景",
    preview: "预览",
    back: "返回",
    empty: "没有匹配的组件。",
    openNav: "打开目录",
    closeNav: "收起目录",
    closeScrim: "关闭目录",
    sourceLib: "源码组件库",
    desktop: "桌面",
    tablet: "平板 768",
    phone: "手机 375",
    reload: "重新加载",
    prev: "上一个",
    next: "下一个",
    scenario: "使用场景",
    viewport: "预览宽度",
    prefs: "偏好",
    language: "语言",
    appearance: "外观",
    light: "亮色",
    dark: "暗色",
    langZh: "中文",
    langEn: "EN",
  },
  en: {
    portal: "Tier0 Components",
    filterNav: "Search categories, components, or descriptions",
    filterPlaceholder: "Search categories, components…",
    review: "Review",
    components: "Components",
    allComponents: "All components",
    business: "Business scenes",
    titleComponents: "Tier0 Components",
    leadComponents: (n: number, cats: number) =>
      `${n} components across ${cats} categories (including heavy). Same Tier0 tokens.`,
    leadBusiness: (n: number) =>
      `${n} business scenes with app sidebar and workbench rail for workflow review.`,
    scenesUnit: "samples",
    preview: "Preview",
    back: "Back",
    empty: "No matching components.",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    closeScrim: "Close navigation",
    sourceLib: "Source library",
    desktop: "Desktop",
    tablet: "Tablet 768",
    phone: "Phone 375",
    reload: "Reload",
    prev: "Previous",
    next: "Next",
    scenario: "Sample",
    viewport: "Viewport width",
    prefs: "Preferences",
    language: "Language",
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    langZh: "中文",
    langEn: "EN",
  },
} as const;

export function t(locale: GalleryLocale) {
  return chrome[locale];
}

export function categoryLabel(locale: GalleryLocale, key: string) {
  if (locale === "zh-CN") {
    if (key === "all") return "全部组件";
    if (key === "business") return "业务场景";
    return key;
  }
  return CATEGORY_EN[key] ?? key;
}

export function itemTitle(locale: GalleryLocale, item: { name: string; label: string }) {
  return locale === "en" ? item.name : item.label;
}
