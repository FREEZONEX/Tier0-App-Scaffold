import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Database,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

const READINESS = [
  {
    label: "Authentication",
    value: "SSO ready",
    detail: "Gateway session and role selection are active.",
    icon: ShieldCheck,
  },
  {
    label: "Data layer",
    value: "Drizzle ready",
    detail: "Schema, seed, and PostgreSQL wiring are in place.",
    icon: Database,
  },
  {
    label: "Interface",
    value: "Shell ready",
    detail: "Authenticated pages inherit the Tier0 workspace shell.",
    icon: Activity,
  },
  {
    label: "Design",
    value: "Tier0 tokens",
    detail: "FX Green, compact controls, and flat panels are configured.",
    icon: BadgeCheck,
  },
];

function DashboardPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="border-b border-border bg-background px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Badge variant="highlight">Tier0 workspace</Badge>
            <h1 className="typo-h3 mt-3">Production application scaffold</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Build MES modules on a TanStack Start, Drizzle, and Tier0 design
              foundation.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted px-3 py-2">
            <p className="caption">Current role</p>
            <p className="mt-0.5 font-mono text-xs uppercase text-foreground">
              {user.role}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-5">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {READINESS.map(({ label, value, detail, icon: Icon }) => (
            <Card key={label} size="sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardDescription className="caption uppercase">
                      {label}
                    </CardDescription>
                    <CardTitle className="mt-1 truncate">{value}</CardTitle>
                  </div>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="min-h-10 text-sm text-muted-foreground">
                  {detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>Implementation path</CardTitle>
              <CardDescription>
                Keep product work in the scaffold&apos;s established layers.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Data", "Define tables and Zod schemas in src/db/schema.ts."],
                  ["Services", "Put state machines and transactions in src/services."],
                  ["Routes", "Keep API handlers thin and wrapped with withErrors."],
                ].map(([title, body], index) => (
                  <div
                    key={title}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      0{index + 1}
                    </span>
                    <h2 className="mt-2 text-sm font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Current workspace identity from the gateway session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="caption">Signed in as</p>
                <p className="mt-1 truncate text-sm font-medium">
                  {user.displayName}
                </p>
                <p className="mt-1 font-mono text-xs uppercase text-muted-foreground">
                  {user.role}
                </p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Template readiness</span>
                  <span className="font-mono text-foreground">4/4</span>
                </div>
                <Progress value={100} />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
