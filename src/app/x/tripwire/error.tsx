"use client"

// src/app/x/tripwire/error.tsx
//
// Surfaces fetch failures from getAggregates() instead of leaving the
// page stuck on a skeleton. Triggered when a Suspense child throws and
// no closer error boundary catches it.

export default function TripwireError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
          tripwire
        </h1>
        <p className="font-mono text-[13px] opacity-55 mt-3">
          stats fetch failed: {error.message}
        </p>
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[12px] uppercase tracking-[0.14em] py-3 px-4 mt-6 border border-current opacity-75 hover:opacity-100 transition-opacity"
        >
          retry
        </button>
      </div>
    </main>
  )
}
