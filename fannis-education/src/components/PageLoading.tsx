export function PageLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-64 max-w-full rounded-lg bg-gray-200/70" />
        <div className="h-4 w-96 max-w-full rounded bg-gray-200/50" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white shadow-card" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white shadow-card" />
    </div>
  );
}
