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
    /** One short line under the title of each view. */
    leads: {
      all: "脚手架内置的全部组件，点开卡片查看样例和引入方式。",
      business: "把组件放进真实工作流，整体验收交互与布局。",
      通用: "按钮、文字、图标，每个页面都会用到的基础元素。",
      布局: "页面容器、表单栅格与表格滚动区，决定内容如何排布。",
      导航: "标签页、锚点、分页和下拉菜单，在页面内外切换。",
      数据录入: "输入、选择、日期、上传等表单控件。",
      数据展示: "表格、卡片、标签和统计数字，用来呈现数据。",
      反馈: "对话框、抽屉、提示、进度与加载状态，告知操作结果。",
      高级组件: "异步状态、图表等由多个基础组件组合而成的能力。",
      重型组件: "元数据表单、明细表、搜索与筛选等完整业务模块。",
    } as Record<string, string>,
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
    leads: {
      all: "Every component in the scaffold. Open a card for samples and import paths.",
      business: "Components in real workflows, for end-to-end review of interaction and layout.",
      通用: "Buttons, text and icons used on every page.",
      布局: "Page containers, form grids and table viewports that arrange content.",
      导航: "Tabs, anchors, pagination and dropdown menus for moving around.",
      数据录入: "Inputs, selects, dates, uploads and other form controls.",
      数据展示: "Tables, cards, tags and stats that present data.",
      反馈: "Dialogs, drawers, toasts, progress and loading states.",
      高级组件: "Async states, charts and other compositions of base components.",
      重型组件: "Metadata forms, detail tables, search and filters: complete business modules.",
    } as Record<string, string>,
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
