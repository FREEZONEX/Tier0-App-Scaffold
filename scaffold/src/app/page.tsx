export default function DashboardPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Manufacturing execution overview
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Output", "OEE", "Quality", "Active Orders"].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--border)] bg-white p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">--</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Loading...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
