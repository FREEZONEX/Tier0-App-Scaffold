import { useEffect, useRef, useState } from "react";

import { ClientOnly } from "@/components/client-only";
import { TemplatePreviewWaveGrid } from "@/components/TemplatePreviewWaveGrid";
import {
  COVER_VARIANTS,
  DEFAULT_COVER_SETTINGS,
  type CoverSettings,
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

const STORAGE_KEY = "tier0.preview-cover-settings";

function loadSettings(): CoverSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COVER_SETTINGS };
    return { ...DEFAULT_COVER_SETTINGS, ...(JSON.parse(raw) as Partial<CoverSettings>) };
  } catch {
    return { ...DEFAULT_COVER_SETTINGS };
  }
}

function saveSettings(s: CoverSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Cover canvas plus a dat.gui tuning panel. Settings live in a mutable ref the
 * renderer reads every frame; the panel writes straight into it and persists
 * to localStorage so a tuned state survives reloads. The simulated mask
 * mirrors the platform's wait mask (backdrop blur + white tint) so the cover
 * can be judged the way it will actually be seen.
 */
function CoverStage() {
  const settingsRef = useRef<CoverSettings>(DEFAULT_COVER_SETTINGS);
  // Snapshot of the DOM-rendered bits (mask + caption); the canvas reads the ref directly.
  const [dom, setDom] = useState<CoverSettings>(DEFAULT_COVER_SETTINGS);

  useEffect(() => {
    settingsRef.current = loadSettings();
    const s = settingsRef.current;
    setDom({ ...s });

    let disposed = false;
    let gui: import("dat.gui").GUI | undefined;

    // dat.gui touches document on construction: client-only dynamic import.
    void import("dat.gui").then((dat) => {
      if (disposed) return;
      gui = new dat.GUI({ width: 320 });
      const host = gui.domElement.parentElement;
      if (host) {
        host.style.zIndex = "60";
        host.style.pointerEvents = "auto";
      }

      const sync = () => {
        saveSettings(s);
        setDom({ ...s });
      };

      gui
        .add(
          s,
          "variant",
          Object.fromEntries(COVER_VARIANTS.map((v) => [v.label, v.id])),
        )
        .name("Variant")
        .onChange(sync);

      const grid = gui.addFolder("Grid");
      grid.add(s, "cell", 8, 80, 1).name("Cell size (px)").onChange(sync);
      grid.add(s, "fontSize", 6, 40, 1).name("Font size (px)").onChange(sync);
      grid.add(s, "density", 0.05, 1, 0.01).name("Density").onChange(sync);
      grid.add(s, "flipChance", 0, 1, 0.01).name("Flip chance").onChange(sync);
      grid.add(s, "flipInterval", 30, 1000, 10).name("Flip interval (ms)").onChange(sync);
      grid.open();

      const look = gui.addFolder("Brightness");
      look.add(s, "alphaBase", 0, 1, 0.01).name("Alpha base").onChange(sync);
      look.add(s, "alphaRange", 0, 1, 0.01).name("Alpha range").onChange(sync);
      look.add(s, "colorMix", 0, 1, 0.01).name("Green mix").onChange(sync);
      look.add(s, "contrast", 0.5, 4, 0.05).name("Contrast").onChange(sync);
      look.open();

      const motion = gui.addFolder("Motion");
      motion.add(s, "speed", 0, 4, 0.05).name("Speed").onChange(sync);
      motion.add(s, "scale", 0.25, 4, 0.05).name("Patch scale").onChange(sync);
      motion.add(s, "breathPeriod", 0, 20, 0.5).name("Breath period (s)").onChange(sync);
      motion.add(s, "breathMin", 0, 1, 0.01).name("Breath min").onChange(sync);
      motion.add(s, "twinkle", 0, 1, 0.01).name("Twinkle").onChange(sync);
      motion.open();

      const logo = gui.addFolder("Embossed logo");
      logo.add(s, "logoSize", 0.1, 1, 0.01).name("Logo size").onChange(sync);
      logo.add(s, "logoBase", 0, 1, 0.01).name("Field outside").onChange(sync);
      logo.add(s, "logoStrength", 0, 1, 0.01).name("Logo strength").onChange(sync);
      logo.add(s, "logoPulsePeriod", 0, 10, 0.5).name("Pulse period (s)").onChange(sync);
      logo.add(s, "logoFeather", 0, 3, 0.1).name("Edge feather").onChange(sync);

      const wordmark = gui.addFolder("T0 wordmark");
      wordmark.add(s, "wordmarkSize", 0.2, 1, 0.01).name("Wordmark size").onChange(sync);
      wordmark.add(s, "wordmarkThreshold", 0, 1, 0.01).name("Edge threshold").onChange(sync);

      const ascii = gui.addFolder("ASCII logo");
      ascii.add(s, "asciiSize", 0.2, 1, 0.01).name("Logo size").onChange(sync);
      ascii.add(s, "asciiTile").name("Draw tile").onChange(sync);
      ascii.add(s, "asciiTileAlpha", 0, 1, 0.01).name("Tile alpha").onChange(sync);
      ascii.add(s, "asciiGlyphAlpha", 0, 1, 0.01).name("T/0 alpha").onChange(sync);
      ascii.add(s, "asciiHalo", 0, 10, 0.5).name("Halo width (cells)").onChange(sync);
      ascii.add(s, "asciiHaloAlpha", 0, 1, 0.01).name("Halo alpha").onChange(sync);
      ascii.add(s, "asciiShimmer", 0, 1, 0.01).name("Shimmer").onChange(sync);
      ascii.add(s, "asciiShimmerPeriod", 0.5, 12, 0.5).name("Shimmer period (s)").onChange(sync);

      const caption = gui.addFolder("Caption");
      caption.add(s, "captionShow").name("Show").onChange(sync);
      caption.add(s, "captionText").name("Text").onChange(sync);
      caption.add(s, "captionX", 0, 100, 0.5).name("X (%)").onChange(sync);
      caption.add(s, "captionY", 0, 100, 0.5).name("Y (%)").onChange(sync);
      caption.add(s, "captionFont", { Sans: "sans", Mono: "mono" }).name("Font").onChange(sync);
      caption.add(s, "captionSize", 8, 64, 1).name("Size (px)").onChange(sync);
      caption.add(s, "captionWeight", 100, 900, 100).name("Weight").onChange(sync);
      caption.addColor(s, "captionColor").name("Color").onChange(sync);
      caption.add(s, "captionOpacity", 0, 1, 0.01).name("Opacity").onChange(sync);
      caption.add(s, "captionMaxWidth", 120, 1200, 10).name("Max width (px)").onChange(sync);
      caption.open();

      const maskFolder = gui.addFolder("Simulate wait mask");
      maskFolder.add(s, "simulateMask").name("Enable").onChange(sync);
      maskFolder.add(s, "maskOpacity", 0, 1, 0.01).name("White opacity").onChange(sync);
      maskFolder.add(s, "maskBlur", 0, 30, 1).name("Blur (px)").onChange(sync);
      maskFolder.open();

      gui
        .add(
          {
            reset: () => {
              Object.assign(s, DEFAULT_COVER_SETTINGS);
              gui?.updateDisplay();
              sync();
            },
          },
          "reset",
        )
        .name("Reset to defaults");
      gui
        .add(
          {
            copy: () => {
              void navigator.clipboard?.writeText(JSON.stringify(s, null, 2));
            },
          },
          "copy",
        )
        .name("Copy settings JSON");
    });

    return () => {
      disposed = true;
      gui?.destroy();
    };
  }, []);

  return (
    <>
      <TemplatePreviewWaveGrid settingsRef={settingsRef} />
      {dom.captionShow && (
        <p
          className="pointer-events-none absolute m-0 -translate-x-1/2 -translate-y-1/2 text-center leading-relaxed"
          style={{
            left: `${dom.captionX}%`,
            top: `${dom.captionY}%`,
            maxWidth: dom.captionMaxWidth,
            fontFamily: dom.captionFont === "mono" ? "var(--font-app-mono, ui-monospace, monospace)" : "var(--font-app-sans, system-ui, sans-serif)",
            fontSize: dom.captionSize,
            fontWeight: dom.captionWeight,
            color: dom.captionColor,
            opacity: dom.captionOpacity,
          }}
        >
          {dom.captionText}
        </p>
      )}
      {dom.simulateMask && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{ backdropFilter: `blur(${dom.maskBlur}px)`, WebkitBackdropFilter: `blur(${dom.maskBlur}px)` }}
          />
          <div className="absolute inset-0 bg-background" style={{ opacity: dom.maskOpacity }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-highlight" />
            <div className="text-sm font-medium text-foreground">Generating your app…</div>
            <div className="text-sm text-muted-foreground">
              Tips: Use the console to inspect runtime errors while the agent iterates.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
