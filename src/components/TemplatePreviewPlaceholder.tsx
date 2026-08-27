import { useState } from "react";

import { ClientOnly } from "@/components/client-only";
import { TemplatePreviewWaveGrid } from "@/components/TemplatePreviewWaveGrid";
import {
  COVER_VARIANTS,
  getCoverVariant,
  LOGO_T_PATH,
  LOGO_TILE_SIZE,
  LOGO_ZERO_PATH,
  readCoverId,
  writeCoverId,
} from "@/components/template-preview-covers";

export function TemplatePreviewPlaceholder() {
  return (
    <section
      className="template-preview-placeholder pointer-events-none fixed inset-0 z-50 hidden min-h-svh items-center justify-center overflow-hidden bg-background text-foreground"
      aria-label="Start building to see your Tier0 app here."
    >
      <ClientOnly>
        <CoverStage />
      </ClientOnly>
    </section>
  );
}

function CoverStage() {
  const [coverId, setCoverId] = useState(readCoverId);
  const variant = getCoverVariant(coverId);

  const select = (id: string) => {
    setCoverId(id);
    writeCoverId(id);
  };

  return (
    <>
      <TemplatePreviewWaveGrid variantId={variant.id} />
      {variant.overlay === "outline-logo" && <OutlineLogo />}
      <CoverSwitcher value={variant.id} onChange={select} />
    </>
  );
}

/**
 * Light outline version of the builder logo: stroke only in the tertiary
 * text grey, no dark tile, so it blurs into nothing under the platform's
 * wait mask instead of bleeding through as a dark blob.
 */
function OutlineLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${LOGO_TILE_SIZE} ${LOGO_TILE_SIZE}`}
      className="pointer-events-none relative size-36 text-muted-foreground opacity-40 sm:size-44"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.9}
      strokeLinejoin="round"
    >
      <rect x={0.6} y={0.6} width={LOGO_TILE_SIZE - 2} height={LOGO_TILE_SIZE - 2} rx={5} />
      <path d={LOGO_T_PATH} />
      <path d={LOGO_ZERO_PATH} />
    </svg>
  );
}

/** Temporary cover picker for side-by-side evaluation; persists to localStorage. */
function CoverSwitcher({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <label className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
      <span>Cover</span>
      <select
        className="bg-transparent text-foreground outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {COVER_VARIANTS.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}
