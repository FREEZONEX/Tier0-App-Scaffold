export function TemplatePreviewPlaceholder() {
  return (
    <section
      className="template-preview-placeholder pointer-events-none fixed inset-0 z-50 hidden min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground"
      aria-labelledby="template-preview-title"
    >
      <div className="flex w-full max-w-md -translate-y-[3vh] flex-col items-center text-center">
        <img
          src="/builder-logo-dark.svg"
          alt="Tier0"
          className="size-14 rounded-lg shadow-sm sm:size-16"
        />

        <h1
          id="template-preview-title"
          className="mt-6 text-sm font-normal leading-6 text-muted-foreground sm:text-base"
        >
          Start building to see your Tier0 app here.
        </h1>
      </div>
    </section>
  );
}
