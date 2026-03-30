"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-sm font-medium text-red-600">Something went wrong</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium transition-colors hover:bg-gray-50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
