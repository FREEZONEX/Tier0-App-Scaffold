import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { MetaListPage } from "@/components/kit/meta/meta-list-page";
import type { RowAction, TopTab } from "@/components/kit/meta/types";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { StatusBadge } from "@/components/ui";
import { MesKitProvider } from "@/components/mes/MesKitProvider";
import { RecipeFormDialog } from "@/components/mes/RecipeFormDialog";
import { can } from "@/lib/permissions";
import { useRecordChanges } from "@/lib/record-changes";
import { apiUrl } from "@/lib/utils";
import { errorText, sendJson } from "@/lib/mes-client";
import { RECIPE_OBJECT } from "@/lib/mes-list-config";
import type { RecipeRow } from "@/lib/mes-types";
import type { QueryResult } from "@/lib/component-kit/types";
import type { AppUser } from "@/lib/users";
import { Ban, CircleCheck, PenLine } from "lucide-react";

export const Route = createFileRoute("/_app/recipes")({
  component: RecipesPage,
});

function RecipesPage() {
  const { user } = Route.useRouteContext() as { user: AppUser };
  const canManage = can(user.roles, "manage_recipes");
  const [reloadKey, setReloadKey] = useState(0);
  const [counts, setCounts] = useState({ active: 0, inactive: 0 });
  const [formState, setFormState] = useState<{ recipe?: RecipeRow } | null>(null);
  const [toggleTarget, setToggleTarget] = useState<RecipeRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  useRecordChanges(["mes_recipes"], reload);

  const onDataLoaded = useCallback((result: QueryResult<Record<string, unknown>>) => {
    const next = { active: 0, inactive: 0 };
    for (const group of result.groups ?? []) {
      if (group.value === "ACTIVE") next.active = group.count;
      if (group.value === "INACTIVE") next.inactive = group.count;
    }
    setCounts(next);
  }, []);

  const topTabs: TopTab[] = [
    { key: "active", label: "启用中", scope: "ACTIVE", count: counts.active },
    { key: "inactive", label: "已停用", scope: "INACTIVE", count: counts.inactive },
    { key: "all", label: "全部", count: counts.active + counts.inactive },
  ];

  async function toggleActive() {
    if (!toggleTarget) return;
    const nextActive = !toggleTarget.active;
    setToggling(true);
    try {
      await sendJson(apiUrl(`/api/recipes/${toggleTarget.id}/active`), {
        method: "POST",
        body: { active: nextActive },
      });
      toast.success(`配方 ${toggleTarget.code} 已${nextActive ? "启用" : "停用"}`);
      setToggleTarget(null);
      reload();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setToggling(false);
    }
  }

  function rowActions(raw: Record<string, unknown>): RowAction[] {
    const row = raw as unknown as RecipeRow;
    return [
      { key: "edit", label: "修改", icon: <PenLine />, hidden: !canManage, onClick: () => setFormState({ recipe: row }) },
      {
        key: "toggle",
        label: row.active ? "停用" : "启用",
        icon: row.active ? <Ban /> : <CircleCheck />,
        danger: row.active,
        tone: row.active ? undefined : "success",
        hidden: !canManage,
        onClick: () => setToggleTarget(row),
      },
    ];
  }

  return (
    <>
      <MesKitProvider roles={user.roles}>
        <MetaListPage
          objectCode={RECIPE_OBJECT}
          title="配方"
          createLabel="新建配方"
          onCreate={canManage ? () => setFormState({}) : undefined}
          topTabs={topTabs}
          defaultTopTab="active"
          reloadKey={reloadKey}
          onDataLoaded={onDataLoaded}
          selectable={false}
          importable={false}
          exportable={false}
          printable={false}
          onOpenRecord={canManage ? (row) => setFormState({ recipe: row as unknown as RecipeRow }) : undefined}
          rowActions={rowActions}
          inlineActionCount={2}
          cellRenderers={{
            status: (row) =>
              row.active ? <StatusBadge tone="running">启用中</StatusBadge> : <StatusBadge tone="idle">已停用</StatusBadge>,
          }}
        />
      </MesKitProvider>

      {formState ? (
        <RecipeFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setFormState(null);
          }}
          recipe={formState.recipe}
          onSaved={reload}
        />
      ) : null}

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => {
          if (!open && !toggling) setToggleTarget(null);
        }}
        title={`${toggleTarget?.active ? "停用" : "启用"}配方 ${toggleTarget?.code ?? ""}`}
        description={
          toggleTarget?.active
            ? "停用后不能再用此配方新建批次；已创建的批次不受影响，可随时重新启用。"
            : "启用后可以用此配方新建批次。"
        }
        confirmLabel={toggleTarget?.active ? "停用" : "启用"}
        destructive={toggleTarget?.active ?? false}
        pending={toggling}
        onConfirm={toggleActive}
      />
    </>
  );
}
