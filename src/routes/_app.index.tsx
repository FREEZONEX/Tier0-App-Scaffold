import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Grid2X2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import {
  defaultModules,
  filterVisibleModules,
  type NavModule,
} from "@/components/Shell";
import { filterSidebarModules } from "@/lib/app-chrome";
import type { AppUser } from "@/lib/users";

export const Route = createFileRoute("/_app/")({
  component: WorkspaceHome,
});

type WorkspaceModule = Required<Pick<NavModule, "key" | "label" | "href">> &
  Pick<NavModule, "badge" | "icon">;

const PINNED_MODULES_KEY_PREFIX = "tier0-home-pinned-modules";
const PINNED_MODULES_EVENT = "tier0-home-pinned-modules-change";

function WorkspaceHome() {
  const { user } = Route.useRouteContext() as { user?: AppUser | null };

  const availableModules = useMemo(
    () =>
      collectWorkspaceModules(
        filterVisibleModules(filterSidebarModules(defaultModules), user?.role),
      ),
    [user?.role],
  );
  const availableModuleMap = useMemo(
    () => new Map(availableModules.map((module) => [module.key, module])),
    [availableModules],
  );
  const defaultPinnedKeys = useMemo(
    () => availableModules.slice(0, 4).map((module) => module.key),
    [availableModules],
  );
  const storageKey = `${PINNED_MODULES_KEY_PREFIX}:${user?.id ?? "default"}`;
  const storedPinnedKeysSnapshot = useSyncExternalStore(
    subscribePinnedModules,
    () => readPinnedModulesSnapshot(storageKey),
    () => null,
  );
  const storedPinnedKeys = useMemo(
    () => parsePinnedModules(storedPinnedKeysSnapshot),
    [storedPinnedKeysSnapshot],
  );
  const pinnedKeys = storedPinnedKeys ?? defaultPinnedKeys;

  const pinnedModules = pinnedKeys
    .map((key) => availableModuleMap.get(key))
    .filter((module): module is WorkspaceModule => Boolean(module));
  const unpinnedModules = availableModules.filter(
    (module) => !pinnedKeys.includes(module.key),
  );

  function persistPinnedKeys(nextPinnedKeys: string[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(nextPinnedKeys));
      window.dispatchEvent(new Event(PINNED_MODULES_EVENT));
    }
  }

  function addModule(moduleKey: string) {
    if (!availableModuleMap.has(moduleKey)) return;
    persistPinnedKeys([...pinnedKeys, moduleKey]);
  }

  function removeModule(moduleKey: string) {
    persistPinnedKeys(pinnedKeys.filter((key) => key !== moduleKey));
  }

  function resetModules() {
    persistPinnedKeys(defaultPinnedKeys);
  }

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-sm border border-highlight-bg-primary bg-highlight-bg-accent px-2.5 py-1 text-xs font-medium text-highlight-foreground">
              <Grid2X2 className="size-3.5" />
              我的工作台
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">
              常用模块
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              将常用页面固定到首页，保留业务首页入口，同时避免新生成应用出现空白首页。
            </p>
          </div>
          <button
            type="button"
            onClick={resetModules}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted/40"
          >
            <RotateCcw className="size-4" />
            恢复默认
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pinnedModules.length ? (
            pinnedModules.map((module) => (
              <PinnedModuleCard
                key={module.key}
                module={module}
                onRemove={() => removeModule(module.key)}
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border bg-card px-6 py-10 text-center md:col-span-2 xl:col-span-4">
              <p className="text-sm font-medium text-foreground">
                暂无固定模块
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                生成业务页面后，可从下方列表加入首页。
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                可添加模块
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                仅显示当前角色可访问的工作区子页面。
              </p>
            </div>
          </div>

          {unpinnedModules.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {unpinnedModules.map((module) => (
                <CatalogModuleRow
                  key={module.key}
                  module={module}
                  onAdd={() => addModule(module.key)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
              当前没有可继续添加的模块。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PinnedModuleCard({
  module,
  onRemove,
}: {
  module: WorkspaceModule;
  onRemove: () => void;
}) {
  const Icon = module.icon;

  return (
    <article className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground">
            {Icon ? <Icon className="size-4" /> : <Grid2X2 className="size-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {module.label}
            </h2>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {module.href}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`移除${module.label}`}
          title={`移除${module.label}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        {module.badge ? (
          <span className="rounded-sm border border-border bg-muted/40 px-2 py-1 font-mono text-[10px] leading-none text-muted-foreground">
            {module.badge}
          </span>
        ) : (
          <span />
        )}
        <Link
          to={module.href as never}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-button-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          打开
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function CatalogModuleRow({
  module,
  onAdd,
}: {
  module: WorkspaceModule;
  onAdd: () => void;
}) {
  const Icon = module.icon;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-foreground">
          {Icon ? <Icon className="size-4" /> : <Grid2X2 className="size-4" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {module.label}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {module.href}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-card text-foreground transition hover:bg-muted/40"
        aria-label={`添加${module.label}`}
        title={`添加${module.label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function collectWorkspaceModules(modules: NavModule[]): WorkspaceModule[] {
  return modules.flatMap((module) => {
    const childModules = module.children
      ? collectWorkspaceModules(module.children)
      : [];
    const self =
      module.href && module.href !== "/"
        ? [
            {
              key: module.key,
              label: module.label,
              href: module.href,
              icon: module.icon,
              badge: module.badge,
            },
          ]
        : [];

    return [...self, ...childModules];
  });
}

function subscribePinnedModules(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", listener);
  window.addEventListener(PINNED_MODULES_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(PINNED_MODULES_EVENT, listener);
  };
}

function readPinnedModulesSnapshot(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(storageKey);
}

function parsePinnedModules(raw: string | null): string[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : null;
  } catch {
    return null;
  }
}
