"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ConstellationRing from "../ConstellationRing";
import {
  agesToOffsets,
  bitmaskToAges,
  toBase62,
} from "../lib/encoding";
import {
  countLifetimeInstances,
  findLifetimeInstances,
} from "../lib/primeMoments";

type Entry = {
  mask: number;
  offsets: number[];
  size: number;
  spread: number;
  instanceCount: number;
};

type Rendered = Entry & {
  instances: number[][];
};

// Decode a uint32 bitmask into an Entry. Returns null if invalid or
// has fewer than 2 lifetime instances.
function decodeEntry(mask: number): Entry | null {
  if (mask <= 0) return null;
  const ages = bitmaskToAges(mask);
  if (ages.length < 2) return null;
  const offsets = agesToOffsets(ages);
  const instanceCount = countLifetimeInstances(offsets);
  if (instanceCount < 2) return null;
  return {
    mask,
    offsets,
    size: offsets.length,
    spread: offsets[offsets.length - 1],
    instanceCount,
  };
}

// Full decode: compute instance tuples. Called only for visible items.
function renderEntry(entry: Entry): Rendered {
  return {
    ...entry,
    instances: findLifetimeInstances(entry.offsets),
  };
}

type SortKey = "instanceCount" | "spread" | "size";

export default function BrowsePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sizeFilter, setSizeFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("instanceCount");
  const [limit, setLimit] = useState(100);

  const [cache] = useState(() => new Map<number, Rendered>());

  useEffect(() => {
    fetch("/data/x/prime-moments/constellations.bin")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const view = new DataView(buf);
        const count = Math.floor(buf.byteLength / 4);
        const decoded: Entry[] = [];
        for (let i = 0; i < count; i++) {
          const mask = view.getUint32(i * 4, true); // little-endian
          const e = decodeEntry(mask);
          if (e) decoded.push(e);
        }
        setEntries(decoded);
        setLoading(false);
      });
  }, []);

  const sorted = useMemo(() => {
    let items = sizeFilter
      ? entries.filter((c) => c.size === sizeFilter)
      : entries;

    items = [...items].sort((a, b) => {
      if (sortBy === "instanceCount") return b.instanceCount - a.instanceCount;
      if (sortBy === "spread") return b.spread - a.spread;
      return a.size - b.size;
    });

    return items.slice(0, limit);
  }, [entries, sizeFilter, sortBy, limit]);

  // Full-decode only the visible slice (compute instance tuples for rendering).
  const visible: Rendered[] = useMemo(() => {
    return sorted.map((entry) => {
      let full = cache.get(entry.mask);
      if (!full) {
        full = renderEntry(entry);
        cache.set(entry.mask, full);
      }
      return full;
    });
  }, [sorted, cache]);

  const totalForFilter = useMemo(
    () =>
      sizeFilter
        ? entries.filter((c) => c.size === sizeFilter).length
        : entries.length,
    [entries, sizeFilter],
  );

  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/x/prime-moments"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← prime moments
          </Link>
        </div>

        <h1 className="text-[32px] sm:text-[40px] font-bold leading-[0.95] tracking-[-0.04em] mb-4">
          Browse Constellations
        </h1>
        <p className="font-mono text-[12px] opacity-55 mb-8">
          {totalForFilter.toLocaleString()} constellations
          {sizeFilter ? ` of size ${sizeFilter}` : ""} · showing{" "}
          {Math.min(limit, totalForFilter)}
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex gap-1">
            {[null, 2, 3, 4, 5, 6].map((s) => (
              <button
                key={s ?? "all"}
                type="button"
                onClick={() => {
                  setSizeFilter(s);
                  setLimit(100);
                }}
                className={`font-mono text-[11px] px-3 py-1.5 border cursor-pointer ${
                  sizeFilter === s
                    ? "bg-ink text-paper border-ink"
                    : "bg-transparent text-ink border-ink/30 hover:border-ink"
                }`}
              >
                {s === null ? "all" : `k=${s}`}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {(
              [
                ["instanceCount", "most instances"],
                ["spread", "widest spread"],
                ["size", "by size"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={`font-mono text-[11px] px-3 py-1.5 border cursor-pointer ${
                  sortBy === key
                    ? "bg-ink text-paper border-ink"
                    : "bg-transparent text-ink border-ink/30 hover:border-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="font-mono text-[12px] opacity-55">
            loading constellations...
          </p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visible.map((c) => {
            const slug = toBase62(c.mask);
            return (
            <a
              key={c.mask}
              href={`/x/prime-moments/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="border border-ink/20 hover:border-ink/60 p-3 no-underline transition-colors"
            >
              <ConstellationRing
                instances={c.instances}
                className="w-full aspect-square"
              />
              <div className="mt-2 font-mono text-[10px] opacity-70 leading-tight">
                [{c.offsets.join(", ")}]
              </div>
              <div className="font-mono text-[10px] opacity-50 mt-0.5">
                {c.instanceCount} instance{c.instanceCount === 1 ? "" : "s"} ·
                k={c.size}
              </div>
            </a>
            );
          })}
        </div>

        )}

        {!loading && limit < totalForFilter && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + 100)}
              className="font-mono text-[12px] px-6 py-2 bg-transparent text-ink border border-ink cursor-pointer hover:bg-ink/5"
            >
              load 100 more
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
