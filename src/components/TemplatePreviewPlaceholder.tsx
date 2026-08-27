import { ClientOnly } from "@/components/client-only";
import { TemplatePreviewWaveGrid } from "@/components/TemplatePreviewWaveGrid";

export function TemplatePreviewPlaceholder() {
  return (
    <section
      className="template-preview-placeholder pointer-events-none fixed inset-0 z-50 hidden min-h-svh items-center justify-center overflow-hidden bg-background text-foreground"
      aria-label="Start building to see your Tier0 app here."
    >
      <ClientOnly>
        <TemplatePreviewWaveGrid />
      </ClientOnly>
    </section>
  );
}
