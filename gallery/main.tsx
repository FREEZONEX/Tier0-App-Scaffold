import { RecordSelect } from "@/components/forms/record-select";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Menu,
  Monitor,
  Moon,
  RotateCw,
  Search,
  Smartphone,
  Sun,
  Tablet,
  X,
} from "lucide-react";
import { Sample } from "./samples";
import catalog from "./integrated-catalog.json";
import scaffoldIndex from "./scaffold-index.json";
import {
  applyGalleryPrefs,
  categoryLabel,
  itemTitle,
  readTheme,
  syncFrameTheme,
  t,
  type GalleryLocale,
  type GalleryTheme,
} from "./i18n";
import "./gallery.css";

type SampleMeta = {
  name: string;
  label: string;
  engine: string;
  importPath?: string;
  source?: string;
};
type Item = {
  name: string;
  label: string;
  category: string;
  layer: string;
  detail?: string;
  reason?: string;
  samples: SampleMeta[];
  origin?: string;
};

const portalCatalog = catalog as Item[];
const sourceCatalog = scaffoldIndex.items as Item[];

const componentCategories = [
  "通用",
  "布局",
  "导航",
  "数据录入",
  "数据展示",
  "反馈",
  "高级组件",
  "重型组件",
];
const isComponent = (item: Item) => item.layer === "base" || item.layer === "extension";
const matches = (item: Item, key: string) => {
  if (key === "all") return isComponent(item);
  if (componentCategories.includes(key)) return isComponent(item) && item.category === key;
  return item.layer === key;
};
/** One catalog: portal first, then source-only rows (e.g. 重型组件 extras). */
const mergedCatalog = (() => {
  const seen = new Set(portalCatalog.map((item) => item.name));
  const extras = sourceCatalog.filter((item) => !seen.has(item.name));
  return [...portalCatalog, ...extras];
})();
const navGroupKeys = [
  { id: "review" as const, keys: ["business"] },
  { id: "components" as const, keys: ["all", ...componentCategories] },
];
const catColor = (key: string) => {
  const i = componentCategories.indexOf(key);
  return i < 0 ? undefined : `var(--tier0-cat-${(i % 6) + 1})`;
};

const params = new URLSearchParams(location.search);
const sampleName = params.get("sample");
const viewParam = params.get("view");
const initialView =
  viewParam && (viewParam === "business" || componentCategories.includes(viewParam))
    ? viewParam
    : "all";

(() => {
  const theme = params.get("theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  } else if (!sampleName) {
    applyGalleryPrefs("zh-CN", readTheme());
  }
})();

function sampleUrl(s: SampleMeta, theme: GalleryTheme) {
  const base =
    s.engine === "original"
      ? `?sample=${encodeURIComponent(s.name)}`
      : `preview.html?sample=${encodeURIComponent(s.name)}`;
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}theme=${theme}`;
}

function centerThumb(frame: HTMLIFrameElement, scene: boolean, theme: GalleryTheme) {
  syncFrameTheme(frame, theme);
  const doc = frame.contentDocument;
  if (!doc?.head || scene) return;
  if (doc.getElementById("doc-thumb-center")) return;
  const style = doc.createElement("style");
  style.id = "doc-thumb-center";
  style.textContent =
    "html,body{overflow:hidden!important}.sample-body{min-height:100vh;display:grid;place-items:center;padding:24px}.sample-body>*{max-width:100%}.demo-status{display:none}";
  doc.head.appendChild(style);
}

function Thumb({ item, theme }: { item: Item; theme: GalleryTheme }) {
  const sample = item.samples[0];
  // Freeze initial src so theme toggles sync via class, not iframe reload.
  const [src] = useState(() => (sample ? sampleUrl(sample, theme) : ""));
  return (
    <div className="doc-thumb" aria-hidden="true">
      {sample ? (
        <iframe
          title=""
          tabIndex={-1}
          loading="lazy"
          src={src}
          className={item.layer === "business" ? "is-scene" : undefined}
          onLoad={(e) => centerThumb(e.currentTarget, item.layer === "business", theme)}
        />
      ) : null}
    </div>
  );
}

function Gallery() {
  const locale: GalleryLocale = "zh-CN";
  const [theme, setTheme] = useState<GalleryTheme>(() => readTheme());
  const [filter, setFilter] = useState(initialView);
  const [query, setQuery] = useState("");
  const [navQuery, setNavQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [scenario, setScenario] = useState(0);
  const [device, setDevice] = useState<string>("100%");
  const [revision, setRevision] = useState(0);
  const [navigationOpen, setNavigationOpen] = useState(false);

  const copy = t(locale);
  const devices = [
    { width: "100%", label: copy.desktop, icon: Monitor },
    { width: "768px", label: copy.tablet, icon: Tablet },
    { width: "375px", label: copy.phone, icon: Smartphone },
  ] as const;

  useEffect(() => {
    applyGalleryPrefs(locale, theme);
  }, [theme]);

  const activeCatalog = mergedCatalog;

  const filtered = useMemo(
    () =>
      activeCatalog.filter(
        (item) =>
          matches(item, filter) &&
          `${item.label} ${item.name} ${item.detail ?? ""} ${item.samples.map((s) => s.name).join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [activeCatalog, filter, query],
  );

  const pills = filter === "business" ? ["business"] : ["all", ...componentCategories];

  const siblings = selected
    ? activeCatalog.filter(
        (i) =>
          matches(i, filter === "business" ? "business" : "all") ||
          i.category === selected.category,
      )
    : [];
  const index = selected ? siblings.findIndex((i) => i.name === selected.name) : -1;
  const current = selected?.samples[scenario] ?? selected?.samples[0];

  function open(item: Item | undefined) {
    if (!item) return;
    setSelected(item);
    setScenario(0);
    setRevision((r) => r + 1);
    setNavigationOpen(false);
    window.scrollTo({ top: 0 });
  }
  function choose(key: string) {
    setFilter(key);
    setQuery("");
    setSelected(null);
    setNavigationOpen(false);
    const url = new URL(location.href);
    if (key === "all") url.searchParams.delete("view");
    else url.searchParams.set("view", key);
    history.replaceState(null, "", url);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totalCount = activeCatalog.filter((item) =>
    filter === "business" ? item.layer === "business" : isComponent(item),
  ).length;

  const nav = (
    <aside id="doc-nav" className={`doc-nav${navigationOpen ? " is-open" : ""}`}>
      <div className="doc-nav-panel">
        <button type="button" className="doc-switch" onClick={() => choose("all")}>
          <span className="doc-switch-icon">
            <LayoutGrid size={16} />
          </span>
          <span className="doc-switch-text">{copy.portal}</span>
          <span className="doc-switch-count">
            {mergedCatalog.filter(isComponent).length}
          </span>
        </button>
        <label className="doc-filter">
          <Search size={14} aria-hidden="true" />
          <input
            aria-label={copy.filterNav}
            placeholder={copy.filterPlaceholder}
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
          />
        </label>
        <nav aria-label={copy.components} className="doc-nav-scroll">
          {navGroupKeys.map((group) => (
            <div key={group.id} className="doc-nav-group">
              <p>{group.id === "review" ? copy.review : copy.components}</p>
              {group.keys
                .filter((key) =>
                  categoryLabel(locale, key)
                    .toLowerCase()
                    .includes(navQuery.trim().toLowerCase()),
                )
                .map((key) => {
                  const active = !selected && filter === key;
                  const count = mergedCatalog.filter((item) => matches(item, key)).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => choose(key)}
                    >
                      <span className="doc-nav-label">
                        {catColor(key) ? (
                          <i className="doc-dot" style={{ background: catColor(key) }} />
                        ) : null}
                        {categoryLabel(locale, key)}
                      </span>
                      <small>{count}</small>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="doc-prefs" role="group" aria-label={copy.appearance}>
          <div className="doc-prefs-seg doc-prefs-theme" role="group" aria-label={copy.appearance}>
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <Sun size={13} aria-hidden="true" />
              {copy.light}
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <Moon size={13} aria-hidden="true" />
              {copy.dark}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  const title = categoryLabel(
    locale,
    filter === "all" ? "all" : filter === "business" ? "business" : filter,
  );
  const pageTitle =
    filter === "all" ? copy.titleComponents : title;

  const lead =
    filter === "business"
      ? copy.leadBusiness(filtered.length)
      : copy.leadComponents(
          mergedCatalog.filter(isComponent).length,
          componentCategories.length,
        );

  return (
    <div className="doc">
      <header className="doc-mobile-bar">
        <strong>{copy.portal}</strong>
        <button
          type="button"
          aria-label={navigationOpen ? copy.closeNav : copy.openNav}
          aria-expanded={navigationOpen}
          aria-controls="doc-nav"
          onClick={() => setNavigationOpen((v) => !v)}
        >
          {navigationOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>
      {nav}

      <main className="doc-main">
        {selected ? (
          <article className="doc-detail" key={selected.name}>
            <button type="button" className="doc-back" onClick={() => setSelected(null)}>
              <ArrowLeft size={15} />
              {copy.back} {categoryLabel(locale, filter)}
            </button>
            <h1>{itemTitle(locale, selected)}</h1>
            <p className="doc-lead">
              {selected.layer !== "business" && selected.detail
                ? selected.detail
                : `${copy.business} · ${selected.name}`}
            </p>

            <div className="doc-toolbar">
              <code className="doc-name">{selected.name}</code>
              {selected.samples.length > 1 ? (
                <div className="doc-scenario">
                  <RecordSelect
                    aria-label={copy.scenario}
                    value={String(scenario)}
                    placeholder=""
                    onChange={(e) => {
                      setScenario(Number(e.target.value));
                      setRevision((r) => r + 1);
                    }}
                    options={selected.samples.map((s, i) => ({
                      value: String(i),
                      label: s.label,
                    }))}
                  />
                </div>
              ) : null}
              <div className="doc-toolbar-end">
                <div className="doc-group" role="group" aria-label={copy.viewport}>
                  {devices.map(({ width, label: name, icon: Icon }) => (
                    <button
                      key={width}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={device === width}
                      onClick={() => setDevice(width)}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
                <div className="doc-group">
                  <button
                    type="button"
                    title={copy.reload}
                    aria-label={copy.reload}
                    onClick={() => setRevision((r) => r + 1)}
                  >
                    <RotateCw size={16} />
                  </button>
                </div>
                <div className="doc-group">
                  <button
                    type="button"
                    title={copy.prev}
                    aria-label={copy.prev}
                    disabled={index <= 0}
                    onClick={() => open(siblings[index - 1])}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    title={copy.next}
                    aria-label={copy.next}
                    disabled={index < 0 || index >= siblings.length - 1}
                    onClick={() => open(siblings[index + 1])}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {current?.importPath ? (
              <pre className="doc-import">
                <code>{`import { ${current.name} } from '${current.importPath}';`}</code>
                {current.source ? <span className="doc-source-path">{current.source}</span> : null}
              </pre>
            ) : null}

            <div className="doc-stage">
              <iframe
                key={`${selected.name}-${scenario}-${revision}`}
                title={`${itemTitle(locale, selected)} ${copy.preview}`}
                style={{ width: device }}
                src={sampleUrl(selected.samples[scenario], theme)}
                onLoad={(e) => syncFrameTheme(e.currentTarget, theme)}
              />
            </div>
          </article>
        ) : (
          <>
            <h1>{pageTitle}</h1>
            <p className="doc-lead">{lead}</p>
            <label className="doc-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label={copy.searchComponents}
                placeholder={
                  filter === "business" ? copy.searchScenes : copy.searchComponents
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="doc-pills-row">
              <div className="doc-pills" role="group" aria-label={copy.components}>
                {pills.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => choose(key)}
                  >
                    {catColor(key) ? (
                      <i className="doc-dot" style={{ background: catColor(key) }} />
                    ) : null}
                    {key === "all"
                      ? copy.all
                      : categoryLabel(locale, key)}
                  </button>
                ))}
              </div>
              <span className="doc-showing">
                {locale === "zh-CN" ? (
                  <>
                    显示 <strong>{filtered.length}</strong> / {totalCount}
                  </>
                ) : (
                  <>
                    Showing <strong>{filtered.length}</strong> / {totalCount}
                  </>
                )}
              </span>
            </div>

            {filtered.length ? (
              <div className="doc-grid">
                {filtered.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    className="doc-card"
                    onClick={() => open(item)}
                  >
                    <Thumb item={item} theme={theme} />
                    <span className="doc-card-body">
                      <span className="doc-card-title">
                        <strong>{itemTitle(locale, item)}</strong>
                        {isComponent(item) && catColor(item.category) ? (
                          <span
                            className="doc-cat"
                            style={
                              {
                                ["--doc-cat-hue"]: catColor(item.category),
                              } as CSSProperties
                            }
                          >
                            {categoryLabel(locale, item.category)}
                          </span>
                        ) : null}
                      </span>
                      <span className="doc-card-desc">
                        {item.layer !== "business" && item.detail && locale === "zh-CN"
                          ? item.detail
                          : item.samples[0]?.importPath || item.name}
                      </span>
                      <span className="doc-card-foot">
                        <span>
                          <b>{item.samples.length}</b> {copy.scenesUnit}
                        </span>
                        <span className="doc-card-go">
                          {copy.preview} <ArrowRight size={14} />
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="doc-empty">{copy.empty}</p>
            )}
          </>
        )}
      </main>
      {navigationOpen ? (
        <button
          type="button"
          aria-label={copy.closeScrim}
          className="doc-scrim"
          onClick={() => setNavigationOpen(false)}
        />
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  sampleName ? <Sample name={sampleName} /> : <Gallery />,
);
