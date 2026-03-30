import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-4xl font-semibold">404</p>
        <p className="mt-2 text-xs text-[var(--muted)]">Page not found</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium transition-colors hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
