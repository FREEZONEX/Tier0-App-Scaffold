import { useState } from "react";
import { createRoot } from "react-dom/client";
import catalog from "./scaffold-catalog.json";
import priorities from "./ux-priority.json";
import "./scaffold-library.css";

const categories = [
  "通用",
  "布局",
  "导航",
  "数据录入",
  "数据展示",
  "反馈",
  "重型组件",
] as const;

const scenes = [
  ["SceneTaskOps", "任务运营台"],
  ["SceneWorkflowHub", "工作流总览"],
  ["SceneAdminDirectory", "组织与主数据"],
  ["SceneAuditTimeline", "审计日志"],
  ["SceneOpsMonitor", "运营监控"],
  ["SceneAgentSpend", "用量与成本"],
  ["SceneEmptyContrast", "空状态与引导"],
] as const;

function Library() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [scene, setScene] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [example, setExample] = useState("");
  const [mobile, setMobile] = useState(false);
  const [revision, setRevision] = useState(0);

  const selected = catalog.items.find((item) => item.id === active);
  const current =
    selected?.examples.find((item) => item.name === example) ??
    selected?.examples[0];

  const visible = [...catalog.items]
    .sort(
      (a, b) =>
        Math.min(
          ...a.examples.map((e) => {
            const i = priorities.indexOf(e.name);
            return i < 0 ? 999 : i;
          }),
        ) -
        Math.min(
          ...b.examples.map((e) => {
            const i = priorities.indexOf(e.name);
            return i < 0 ? 999 : i;
          }),
        ),
    )
    .filter((item) =>
      `${item.label} ${item.examples.map((e) => e.name).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

  function choose(id: string) {
    setScene("");
    setActive(id);
    setExample("");
    setRevision(0);
    setNavigationOpen(false);
  }

  const sceneTitle =
    scenes.find(([key]) => key === scene)?.[1] ?? "业务场景";

  return (
    <div className="source-library">
      <div className="portal-mobile-header">
        <strong>Tier0 · 组件库</strong>
        <button
          type="button"
          aria-expanded={navigationOpen}
          aria-controls="portal-navigation"
          onClick={() => setNavigationOpen((v) => !v)}
        >
          {navigationOpen ? "收起" : "目录"}
        </button>
      </div>

      <aside
        id="portal-navigation"
        className={navigationOpen ? "navigation-open" : ""}
      >
        <header>
          <strong>Tier0 Scaffold</strong>
          <span>源码组件库</span>
          <a href="index.html">← 组件门户</a>
        </header>
        <input
          aria-label="搜索组件"
          placeholder="搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={!active && !scene ? "active" : ""}
          onClick={() => {
            setScene("");
            setActive(null);
          }}
        >
          组件总览
          <small>{catalog.items.length}</small>
        </button>
        <section>
          <h2>业务场景</h2>
          {scenes.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={scene === key ? "active" : ""}
              onClick={() => {
                setScene(key);
                setActive(null);
                setNavigationOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </section>
        {categories.map((category) => (
          <section key={category}>
            <h2>{category}</h2>
            {visible
              .filter((item) => item.category === category)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={active === item.id ? "active" : ""}
                  onClick={() => choose(item.id)}
                >
                  <span>{item.label}</span>
                  <small>{item.id}</small>
                </button>
              ))}
          </section>
        ))}
      </aside>

      <main>
        {scene ? (
          <>
            <h1>{sceneTitle}</h1>
            <div className="preview-toolbar">
              <strong>预览</strong>
              <div>
                <button type="button" onClick={() => setMobile((v) => !v)}>
                  {mobile ? "桌面宽度" : "375px"}
                </button>
              </div>
            </div>
            <div className="source-preview">
              <iframe
                title={sceneTitle}
                style={{
                  width: mobile ? "min(375px, 100%)" : "100%",
                }}
                src={`preview.html?sample=${scene}`}
              />
            </div>
          </>
        ) : selected && current ? (
          <>
            <p className="eyebrow">{selected.category}</p>
            <h1>
              {selected.label} <small>{selected.id}</small>
            </h1>
            <div className="example-tabs" role="group" aria-label="导出">
              {selected.examples.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  aria-pressed={current.name === item.name}
                  onClick={() => {
                    setExample(item.name);
                    setRevision(0);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="preview-toolbar">
              <strong>交互示例</strong>
              <div>
                <button type="button" onClick={() => setMobile((v) => !v)}>
                  {mobile ? "桌面宽度" : "375px"}
                </button>
                <button type="button" onClick={() => setRevision((v) => v + 1)}>
                  重置
                </button>
              </div>
            </div>
            <div className="source-preview">
              <iframe
                key={`${current.name}-${revision}`}
                title={`${current.name} 示例`}
                style={{
                  width: mobile ? "min(375px, 100%)" : "100%",
                }}
                src={`preview.html?sample=${encodeURIComponent(current.name)}`}
              />
            </div>
            <h2>导入</h2>
            <pre>
              <code>{`import { ${current.name} } from '${current.importPath}';`}</code>
            </pre>
          </>
        ) : (
          <>
            <h1>组件总览</h1>
            <div className="source-summary">
              <span>{catalog.items.length} 个条目</span>
              <span>
                {catalog.items.reduce((n, i) => n + i.examples.length, 0)}{" "}
                个导出
              </span>
            </div>
            {categories.map((category) => {
              const items = visible.filter(
                (item) => item.category === category,
              );
              return (
                items.length > 0 && (
                  <section key={category} className="source-category">
                    <h2>
                      {category} <small>{items.length}</small>
                    </h2>
                    <div className="source-grid">
                      {items.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => choose(item.id)}
                        >
                          <strong>{item.label}</strong>
                          <code>{item.id}</code>
                          <span>
                            {item.examples.length > 1
                              ? `${item.examples.length} 个导出`
                              : "查看示例"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )
              );
            })}
            {!visible.length && <p>没有匹配的组件。</p>}
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Library />);
