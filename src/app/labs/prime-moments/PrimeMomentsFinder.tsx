"use client";

import { useId, useState } from "react";

import { formatDate } from "@/lib/dates";

import { findPrimeMoments } from "./lib/primeMoments";
import { encodeShareParam } from "./lib/share";
import type { Constellation, Person } from "./lib/types";

type Draft = Pick<Person, "id" | "name" | "birthDate">;

const newDraft = (): Draft => ({
  id: crypto.randomUUID(),
  name: "",
  birthDate: "",
});

export default function PrimeMomentsFinder() {
  const formId = useId();
  const [drafts, setDrafts] = useState<Draft[]>([newDraft(), newDraft()]);
  const [results, setResults] = useState<Constellation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) =>
      prev.length > 1 ? prev.filter((d) => d.id !== id) : prev,
    );
  };

  const addDraft = () => {
    setDrafts((prev) => [...prev, newDraft()]);
  };

  const calculate = () => {
    setError(null);
    const valid = drafts
      .filter((d) => d.name.trim() && d.birthDate)
      .map((d) => ({ id: d.id, name: d.name.trim(), birthDate: d.birthDate }));
    if (valid.length === 0) {
      setError("Add at least one person with a name and birthday.");
      setResults(null);
      return;
    }
    setResults(findPrimeMoments(valid));
  };

  const onShare = async () => {
    if (!results || results.length === 0) return;
    const offsets = results[0].offsets;
    const url = `${window.location.origin}/labs/prime-moments?share=${encodeShareParam(offsets)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS dev context).
      // Fall back to showing the URL so the sharer can copy manually.
      alert(url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalMoments = results?.reduce((n, c) => n + c.moments.length, 0) ?? 0;

  return (
    <section aria-labelledby={`${formId}-heading`} className="w-full">
      <div className="border-t border-ink pt-7">
        <h2
          id={`${formId}-heading`}
          className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-3"
        >
          your group
        </h2>
        <p className="text-[11px] opacity-50 mb-5 font-mono">
          everything runs in your browser. nothing is sent or stored.
        </p>

        <div className="flex flex-col gap-2.5">
          {drafts.map((d, idx) => (
            <div key={d.id} className="flex flex-wrap gap-3 items-baseline">
              <label className="sr-only" htmlFor={`${formId}-name-${d.id}`}>
                Name for person {idx + 1}
              </label>
              <input
                id={`${formId}-name-${d.id}`}
                type="text"
                placeholder="name"
                value={d.name}
                onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                className="font-mono text-[13px] bg-transparent border-0 border-b border-ink px-0 py-0.5 w-32 placeholder:opacity-40"
              />
              <label className="sr-only" htmlFor={`${formId}-date-${d.id}`}>
                Birthday for person {idx + 1}
              </label>
              <input
                id={`${formId}-date-${d.id}`}
                type="date"
                value={d.birthDate}
                onChange={(e) => updateDraft(d.id, { birthDate: e.target.value })}
                className="font-mono text-[13px] bg-transparent border-0 border-b border-ink px-0 py-0.5"
              />
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  aria-label={`Remove person ${idx + 1}`}
                  className="font-mono text-[14px] opacity-40 hover:opacity-100 bg-transparent border-0 p-1 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            type="button"
            onClick={addDraft}
            className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-transparent text-ink border border-ink cursor-pointer hover:bg-ink/5"
          >
            + add
          </button>
          <button
            type="button"
            onClick={calculate}
            className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-ink text-paper border border-ink cursor-pointer hover:opacity-90"
          >
            find prime moments
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 font-mono text-[12px] border-t border-ink pt-3">
            {error}
          </div>
        )}
      </div>

      {results && (
        <div className="mt-10">
          <h3 className="text-lg font-semibold mb-4">
            {totalMoments === 0
              ? "No prime moments found."
              : `${totalMoments} prime moment${totalMoments === 1 ? "" : "s"} — constellation [${results[0].offsets.join(", ")}]`}
          </h3>

          <div className="flex flex-col">
            {results.flatMap((c) =>
              c.moments.map((m) => (
                <div
                  key={`${c.offsets.join(",")}-${m.startDate}-${m.endDate}`}
                  className="border-t border-ink py-4 grid grid-cols-[140px_1fr] gap-6"
                >
                  <div className="font-mono text-[12px]">
                    {formatDate(m.startDate)}
                    <br />
                    {formatDate(m.endDate)}
                  </div>
                  <div className="text-[14px]">
                    {m.ages.map((a, i) => (
                      <span key={a.name}>
                        {i > 0 && " · "}
                        {a.name}{" "}
                        <span className="font-mono font-bold">{a.age}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )),
            )}
          </div>

          {totalMoments > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onShare}
                aria-label={copied ? "Share URL copied" : "Copy share URL"}
                className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-transparent text-ink border border-ink cursor-pointer hover:bg-ink/5"
              >
                {copied ? "copied ✓" : "share"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
