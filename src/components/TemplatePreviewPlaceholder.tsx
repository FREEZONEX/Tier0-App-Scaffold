import { useEffect, useState } from "react";

import { ClientOnly } from "@/components/client-only";

/**
 * Pre-generation cover: a mac-style window frame centred on a white ground,
 * the Tier0 wordmark and a mono caption inside it, status in the window's
 * footer and small mono labels in the page corners.
 *
 * Everything is light and linear so the platform's blurred wait mask (white
 * 70–95% + backdrop blur) reduces it to a faint window outline and wordmark
 * rather than a dark blob or a muddy field.
 */
export function TemplatePreviewPlaceholder() {
  return (
    <section
      className="template-preview-placeholder template-preview-cover pointer-events-none fixed inset-0 z-50 hidden min-h-svh items-center justify-center overflow-hidden p-6 text-foreground sm:p-12"
      aria-label="Start building to see your Tier0 app here."
    >
      <div className="template-preview-cover__window flex h-[min(62vh,560px)] w-full max-w-[840px] flex-col overflow-hidden rounded-xl bg-background">
        <div className="template-preview-cover__bar flex h-10 shrink-0 items-center gap-2 border-b border-foreground/8 px-4">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="template-preview-cover__mono mr-[52px] flex-1 text-center text-[11px] tracking-[0.06em] text-muted-foreground">
            tier0 — preview — /
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-[22px] px-6">
          <img src="/tier0-logo.svg" alt="Tier0" className="h-7 w-auto sm:h-8" />
          <p className="template-preview-cover__mono m-0 text-center text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            Start building to see your Tier0 app here.
            <span className="template-preview-cover__cursor template-preview-cover__accent">_</span>
          </p>
        </div>

        <div className="template-preview-cover__mono flex h-8 shrink-0 items-center justify-between gap-4 border-t border-foreground/8 px-4 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          <span className="truncate">Scaffold v0 · Gateway auth · SDK ready</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="template-preview-cover__dot size-1.5 rounded-full" />
            <span className="template-preview-cover__accent">Awaiting generation</span>
          </span>
        </div>
      </div>

      <div className="template-preview-cover__mono absolute left-6 top-6 flex flex-col gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:left-12 sm:top-10">
        <div>Tier0 / preview</div>
        <div>
          route <span className="text-foreground">/</span>
        </div>
      </div>
      <div className="template-preview-cover__mono absolute right-6 top-6 flex flex-col gap-1.5 text-right text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:right-12 sm:top-10">
        <div>Status</div>
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
