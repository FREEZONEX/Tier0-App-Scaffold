import { useEffect, useState } from "react";

import { ClientOnly } from "@/components/client-only";

/**
 * Pre-generation cover: a mac-style window centred on a white ground. The
 * window is split like an onboarding sheet — a scene of tilted, overlapping
 * line-art cards (the shell pieces a generated app is built from) on top, a
 * welcome copy block in the middle and a step rail with status at the foot.
 *
 * Everything is thin lines and pale fills so the platform's blurred wait mask
 * (white 70–95% + backdrop blur) reduces it to a faint window outline and
 * wordmark rather than a dark blob or a muddy field.
 */
export function TemplatePreviewPlaceholder() {
  return (
    <section
      className="template-preview-placeholder template-preview-cover pointer-events-none fixed inset-0 z-50 hidden min-h-svh items-center justify-center overflow-hidden p-6 text-foreground sm:p-12"
      aria-label="Start building to see your Tier0 app here."
    >
      <div className="template-preview-cover__window flex h-[min(76vh,640px)] w-full max-w-[880px] flex-col overflow-hidden rounded-xl bg-background">
        {/* Title bar */}
        <div className="template-preview-cover__bar flex h-10 shrink-0 items-center gap-2 border-b border-foreground/5 px-4">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="template-preview-cover__mono mr-[52px] flex-1 text-center text-[11px] tracking-[0.06em] text-muted-foreground">
            tier0 — preview — /
          </span>
        </div>

        {/* Scene */}
        <div className="template-preview-cover__scene relative flex-1 overflow-hidden border-b border-foreground/5">
          <Scene />
        </div>

        {/* Copy */}
        <div className="shrink-0 px-8 py-6 sm:px-10 sm:py-7">
          <div className="flex items-center gap-3">
            <img src="/tier0-logo.svg" alt="Tier0" className="h-5 w-auto" />
            <h2 className="m-0 text-[17px] font-medium tracking-[-0.01em] text-foreground">
              Start building to see your app here
              <span className="template-preview-cover__cursor template-preview-cover__accent">_</span>
            </h2>
          </div>
          <p className="m-0 mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-muted-foreground">
            This route is a blank scaffold. Describe what you want and Tier0 fills it with
            a shell, data tables, forms and actions wired to the platform — replacing this
            cover as soon as the first screen is generated.
          </p>
        </div>

        {/* Footer rail */}
        <div className="template-preview-cover__mono flex h-12 shrink-0 items-stretch border-t border-foreground/5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          <div className="flex items-center whitespace-nowrap border-r border-foreground/5 px-4 sm:px-5">
            Scaffold v0
          </div>
          <div className="flex flex-1 items-center justify-center gap-2.5">
            <Step label="Scaffold" state="done" />
            <Step label="Generate" state="active" />
            <Step label="Data" />
            <Step label="Actions" />
            <Step label="Ship" />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap border-l border-foreground/5 px-4 sm:px-5">
            <span className="template-preview-cover__dot size-1.5 rounded-full" />
            <span className="template-preview-cover__accent">Awaiting generation</span>
          </div>
        </div>
      </div>

      {/* Page corners */}
      <div className="template-preview-cover__mono absolute left-6 top-6 flex flex-col gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:left-12 sm:top-10">
        <div>Tier0 / preview</div>
        <div>
          route <span className="text-foreground">/</span>
        </div>
      </div>
      <div className="template-preview-cover__mono absolute right-6 top-6 flex flex-col gap-1.5 text-right text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:right-12 sm:top-10">
        <div>Gateway auth · SDK ready</div>
        <div className="template-preview-cover__accent">Awaiting generation</div>
      </div>
      <div className="template-preview-cover__mono absolute bottom-6 right-6 text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:bottom-10 sm:right-12">
        <ClientOnly fallback={<span>00:00:00</span>}>
          <Elapsed />
        </ClientOnly>
      </div>
    </section>
  );
}

function Step({ label, state }: { label: string; state?: "done" | "active" }) {
  return (
    <span className="flex items-center gap-1.5" aria-current={state === "active" ? "step" : undefined}>
      <span
        className={
          "size-1.5 rounded-full " +
          (state === "done"
            ? "bg-foreground/40"
            : state === "active"
              ? "template-preview-cover__dot template-preview-cover__pulse"
              : "bg-foreground/12")
        }
      />
      <span
        className={
          "hidden sm:inline " +
          (state === "active" ? "text-foreground" : state ? "" : "text-foreground/45")
        }
      >
        {label}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Scene: tilted, overlapping line-art cards of the shell pieces a generated
 * app is assembled from. Pure CSS/HTML so it inherits the token palette and
 * blurs cleanly under the wait mask.
 * ------------------------------------------------------------------------ */

function Scene() {
  return (
    <div className="template-preview-scene absolute inset-0" aria-hidden="true">
      {/* Back: editor-like app frame, slightly tilted */}
      <Card className="left-[9%] top-[8%] w-[70%] rotate-[-2deg]" tall>
        <div className="flex h-8 items-center gap-2 border-b border-[var(--tier0-border-secondary)] px-3">
          <Chip w={72} />
          <Chip w={20} />
          <Chip w={20} />
          <Chip w={20} />
          <Chip w={20} />
          <span className="flex-1" />
          <Chip w={54} accent />
        </div>
        <div className="flex h-full">
          <div className="w-[26%] border-r border-[var(--tier0-border-secondary)] p-3">
            <Line w="60%" strong />
            <Line w="80%" />
            <Line w="70%" />
            <Line w="55%" />
            <Line w="75%" />
            <Line w="45%" />
          </div>
          <div className="flex-1 p-3">
            <Line w="35%" strong />
            <Table />
          </div>
        </div>
      </Card>

      {/* Left: "New record" sheet, tilted the other way */}
      <Card className="left-[3%] top-[36%] w-[24%] rotate-[-7deg]">
        <div className="p-3">
          <Line w="55%" strong />
          <Field />
          <Field />
          <div className="flex gap-2">
            <Field half />
            <Field half />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Chip w={40} />
            <Chip w={48} accent />
          </div>
        </div>
      </Card>

      {/* Middle: notes / detail panel */}
      <Card className="left-[44%] top-[34%] w-[30%] rotate-[4deg]">
        <div className="flex items-center gap-2 p-3 pb-2">
          <Chip w={14} />
          <span className="flex-1" />
          <Chip w={14} />
          <Chip w={14} />
        </div>
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <Caret />
            <Line w="42%" strong />
          </div>
          <Line w="70%" />
          <div className="mt-2 flex items-center gap-1.5">
            <Caret />
            <Line w="48%" strong />
          </div>
          <Line w="64%" />
          <Line w="30%" />
        </div>
      </Card>

      {/* Right: command palette with dropdown */}
      <Card className="left-[62%] top-[48%] w-[32%] rotate-[6deg]">
        <div className="p-2.5">
          <div className="flex h-7 items-center gap-2 rounded-md border border-[var(--tier0-border)] bg-[var(--tier0-bg-secondary)] px-2">
            <span className="size-2.5 rounded-full border border-[var(--tier0-text-tertiary)]" />
            <Line w="60%" strong tight />
          </div>
          <div className="mt-2 inline-flex h-5 items-center gap-1 rounded-sm border border-[var(--tier0-border)] px-1.5">
            <span className="text-[9px] leading-none text-[var(--tier0-text-tertiary)]">+</span>
            <Line w={44} tight />
          </div>
        </div>
      </Card>
      <Card className="left-[66%] top-[74%] w-[24%] rotate-[6deg]">
        <div className="p-2">
          <Row />
          <Row />
          <Row />
          <Row accent />
        </div>
      </Card>

      {/* Top-right: floating metric tile */}
      <Card className="left-[74%] top-[10%] w-[22%] rotate-[3deg]">
        <div className="p-3">
          <Line w="50%" />
          <div className="mt-1.5 h-4 w-[45%] rounded-sm bg-[var(--tier0-text-color)]/12" />
          <Spark />
        </div>
      </Card>
    </div>
  );
}

function Card({ className, tall, children }: { className: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        "template-preview-scene__card absolute overflow-hidden rounded-lg border border-[var(--tier0-border)] bg-white " +
        (tall ? "aspect-[16/10] " : "") +
        className
      }
    >
      {children}
    </div>
  );
}

function Line({
  w,
  strong,
  tight,
}: {
  w: string | number;
  strong?: boolean;
  tight?: boolean;
}) {
  return (
    <div
      className={
        "h-1 rounded-full " +
        (strong ? "bg-[var(--tier0-text-color)]/16 " : "bg-[var(--tier0-surface-muted)] ") +
        (tight ? "" : "mb-2")
      }
      style={{ width: w }}
    />
  );
}

function Chip({ w, accent }: { w: number; accent?: boolean }) {
  return (
    <span
      className={
        "h-4 rounded-sm border " +
        (accent
          ? "border-[var(--tier0-highlight-deep)]/40 bg-[var(--tier0-highlight-bg-accent)]"
          : "border-[var(--tier0-border-secondary)] bg-[var(--tier0-bg-tertiary)]")
      }
      style={{ width: w }}
    />
  );
}

function Field({ half }: { half?: boolean }) {
  return (
    <div className={"mb-2 " + (half ? "flex-1" : "")}>
      <Line w="40%" tight />
      <div className="mt-1 h-6 rounded-md border border-[var(--tier0-input-border)]/60 bg-[var(--tier0-input-bg)]" />
    </div>
  );
}

function Table() {
  return (
    <div className="mt-1 overflow-hidden rounded-md border border-[var(--tier0-border-secondary)]">
      <div className="flex gap-3 border-b border-[var(--tier0-border-secondary)] bg-[var(--tier0-bg-tertiary)] px-2 py-1.5">
        <Line w="18%" strong tight />
        <Line w="26%" strong tight />
        <Line w="14%" strong tight />
        <Line w="20%" strong tight />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[var(--tier0-border-secondary)] px-2 py-1.5 last:border-b-0">
          <Line w="18%" tight />
          <Line w="26%" tight />
          <span className={"h-3.5 w-[14%] rounded-full " + (i % 2 ? "bg-[var(--tier0-highlight-bg-accent)]" : "bg-[var(--tier0-bg-accent)]")} />
          <Line w="20%" tight />
        </div>
      ))}
    </div>
  );
}

function Row({ accent }: { accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className={"size-2.5 rounded-sm border " + (accent ? "border-[var(--tier0-highlight-deep)]/60" : "border-[var(--tier0-text-tertiary)]/60")} />
      <Line w={accent ? 64 : 56} tight />
    </div>
  );
}

function Caret() {
  return <span className="size-1.5 rotate-45 border-b border-r border-[var(--tier0-text-tertiary)]" />;
}

function Spark() {
  return (
    <svg viewBox="0 0 100 28" className="mt-2 h-7 w-full" fill="none">
      <path
        d="M0 22 C12 20, 18 12, 28 14 S44 24, 54 16 S70 4, 82 8 S94 14, 100 6"
        stroke="var(--tier0-highlight-deep)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M0 22 C12 20, 18 12, 28 14 S44 24, 54 16 S70 4, 82 8 S94 14, 100 6 V28 H0 Z"
        fill="var(--tier0-highlight-bg-accent)"
        opacity="0.5"
      />
    </svg>
  );
}

/** Seconds since the cover mounted, as hh:mm:ss. */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span>
      {pad(Math.floor(seconds / 3600))}:{pad(Math.floor((seconds % 3600) / 60))}:{pad(seconds % 60)}
    </span>
  );
}
