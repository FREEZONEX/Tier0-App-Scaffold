export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--accent)]" />
        <p className="mt-3 text-xs text-[var(--muted)]">Loading...</p>
      </div>
    </div>
  );
}
