import { useEffect, useState } from "react";

import { ClientOnly } from "@/components/client-only";

/**
 * Pre-generation cover: white ground, one crosshair, a slowly rotating tick
 * ring, the Tier0 wordmark on the crossing and a mono caption beneath it.
 *
 * Everything is light and linear so the platform's blurred wait mask (white
 * 70–95% + backdrop blur) reduces it to a faint wordmark and a hint of green
 * crosshair rather than a dark blob or a muddy field.
 */
export function TemplatePreviewPlaceholder() {
  return (
    <section
      className="template-preview-placeholder template-preview-cover pointer-events-none fixed inset-0 z-50 hidden min-h-svh overflow-hidden bg-background text-foreground"
      aria-label="Start building to see your Tier0 app here."
    >
      {/* crosshair */}
      <div className="template-preview-cover__line absolute inset-y-0 left-1/2 w-px" />
      <div className="template-preview-cover__line absolute inset-x-0 top-1/2 h-px" />

      {/* tick ring */}
      <svg
        aria-hidden="true"
        viewBox="0 0 520 520"
        fill="none"
        className="absolute left-1/2 top-1/2 size-[min(58vmin,520px)] -translate-x-1/2 -translate-y-1/2"
      >
        <g className="template-preview-cover__ring">
          <circle cx="260" cy="260" r="240" className="template-preview-cover__ring-outer" strokeWidth="1" strokeDasharray="2 10" />
          <circle cx="260" cy="260" r="180" className="template-preview-cover__ring-inner" strokeWidth="1" />
          <path d="M260 20 L260 40 M500 260 L480 260 M260 500 L260 480 M20 260 L40 260" className="template-preview-cover__tick" strokeWidth="1.5" />
        </g>
      </svg>

      {/* wordmark on the crossing */}
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        <img src="/tier0-logo.svg" alt="Tier0" className="h-10 w-auto sm:h-12" />
      </div>

      {/* caption */}
      <p className="template-preview-cover__mono absolute inset-x-0 top-1/2 mt-11 flex justify-center px-6 text-center text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        Start building to see your Tier0 app here.
        <span className="template-preview-cover__cursor template-preview-cover__accent">_</span>
      </p>

      {/* corner labels */}
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
      <div className="template-preview-cover__mono absolute bottom-6 left-6 text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:bottom-10 sm:left-12">
        Scaffold v0 · Gateway auth · SDK ready
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
