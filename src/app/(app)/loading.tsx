export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-[var(--accent)]" />
        <p className="mt-3 text-xs text-muted-foreground">Loading&hellip;</p>
      </div>
    </div>
  );
}
