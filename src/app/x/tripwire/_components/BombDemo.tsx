"use client"

// src/app/x/tripwire/_components/BombDemo.tsx
//
// Browser-safe demo of the gzip-bomb mechanic. Click a button → fetch the
// matching demo route → the browser inflates the response transparently
// (Content-Encoding: gzip) and we display the resulting size + a clipped
// preview of the decompressed body. The wire bytes are tiny (kilobytes);
// the inflated bytes are megabytes — the same trick the production bombs
// pull on scanners, scaled down so a visitor's tab survives.

import { useState } from "react"
import { momentColor } from "./colors"

const KINDS = ["html", "json", "yaml", "env"] as const
type Kind = (typeof KINDS)[number]

const PREVIEW_BYTES = 800
const KIND_LABELS: Record<Kind, string> = {
  html: "html",
  json: "json",
  yaml: "yaml",
  env: ".env",
}

interface Result {
  kind: Kind
  inflatedBytes: number
  elapsedMs: number
  preview: string
  truncated: boolean
}

export function BombDemo() {
  const [loading, setLoading] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function trigger(kind: Kind) {
    if (loading) return
    setLoading(kind)
    setError(null)
    const t0 = performance.now()
    try {
      const res = await fetch(`/api/tripwire/bomb-demo/${kind}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const elapsedMs = Math.round(performance.now() - t0)
      const inflatedBytes = new Blob([text]).size
      setResult({
        kind,
        inflatedBytes,
        elapsedMs,
        preview: text.slice(0, PREVIEW_BYTES),
        truncated: text.length > PREVIEW_BYTES,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        try one
      </h3>
      <p className="font-mono text-[12px] opacity-75 mb-4">
        Each button fetches a kilobyte-sized gzip file. Your browser inflates
        it transparently. Watch the decompressed-byte counter.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {KINDS.map((kind, i) => {
          const color = momentColor(i)
          const isLoading = loading === kind
          return (
            <button
              key={kind}
              onClick={() => trigger(kind)}
              disabled={loading !== null}
              className="font-mono text-[12px] uppercase tracking-[0.14em] py-3 border border-current opacity-75 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              style={{ color }}
            >
              {isLoading ? "inflating…" : KIND_LABELS[kind]}
            </button>
          )
        })}
      </div>

      {error ? (
        <p className="font-mono text-[12px] opacity-75 mb-2" style={{ color: "var(--color-moment-2)" }}>
          error: {error}
        </p>
      ) : null}

      {result ? <ResultPanel result={result} /> : null}
    </div>
  )
}

function ResultPanel({ result }: { result: Result }) {
  const color = momentColor(KINDS.indexOf(result.kind))
  const mb = (result.inflatedBytes / 1_000_000).toFixed(2)
  return (
    <div className="border-l-2 pl-4 mt-2" style={{ borderColor: color }}>
      <p className="font-mono text-[12px] mb-2">
        <span style={{ color }} className="uppercase tracking-[0.14em]">{KIND_LABELS[result.kind]}</span>
        <span className="opacity-55"> · decompressed </span>
        <span className="tabular-nums" style={{ color }}>{mb} MB</span>
        <span className="opacity-55"> in </span>
        <span className="tabular-nums" style={{ color }}>{result.elapsedMs} ms</span>
      </p>
      <pre className="font-mono text-[11px] opacity-75 max-h-48 overflow-auto bg-black/5 dark:bg-white/5 p-3 whitespace-pre-wrap break-all">
        {result.preview}
        {result.truncated && (
          <span className="opacity-55">…</span>
        )}
      </pre>
    </div>
  )
}
