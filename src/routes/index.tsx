import {
  createFileRoute,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { HmiLayout } from "@/components/layouts/HmiLayout";
import { HmiPage } from "@/hmi/components/HmiPage";
import { loadDefaultMimicFn, parseDto } from "@/hmi/data/mimic-store";
import { pickLang, type Lang } from "@/hmi/i18n/translate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { AppUser } from "@/lib/users";

const fetchHmiUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

const detectLangFn = createServerFn().handler(
  (): Lang => pickLang(getRequest().headers.get("accept-language")),
);

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    const user = await fetchHmiUser();
    if (!user) {
      throw redirect({ to: "/login", search: { from: location.pathname } });
    }
    return { user };
  },
  loader: async () => ({
    current: await loadDefaultMimicFn(),
    lang: await detectLangFn(),
  }),
  component: HmiRoute,
  errorComponent: HmiError,
});

function HmiRoute() {
  const { current, lang } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  return (
    <HmiLayout user={user}>
      <HmiPage
        initialMimic={parseDto(current)}
        canEdit={can(user.role, "edit_mimic")}
        initialLang={lang}
      />
    </HmiLayout>
  );
}

function HmiError({ error }: ErrorComponentProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{`页面错误：${error.message}`}</p>
    </div>
  );
}
