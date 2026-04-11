"use client";

import { useId, useState } from "react";

import { findPrimeMoments } from "./lib/primeMoments";
import type { Constellation, FamilyMember } from "./lib/types";

type Draft = Pick<FamilyMember, "id" | "name" | "birthDate">;

const newDraft = (): Draft => ({
  id: crypto.randomUUID(),
  name: "",
  birthDate: "",
});

const formatDate = (iso: string): string => {
  // iso is YYYY-MM-DD; render in UTC to avoid TZ drift in display.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function PrimeMomentsFinder() {
  const formId = useId();
  const [drafts, setDrafts] = useState<Draft[]>([newDraft(), newDraft()]);
  const [results, setResults] = useState<Constellation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError("Add at least one family member with a name and birthday.");
      setResults(null);
      return;
    }

    setResults(findPrimeMoments(valid));
  };

  const totalMoments = results?.reduce((n, c) => n + c.moments.length, 0) ?? 0;

  return (
    <section aria-labelledby={`${formId}-heading`} className="w-full">
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body gap-6">
          <div>
            <h2 id={`${formId}-heading`} className="card-title text-2xl">
              Find your prime moments
            </h2>
            <p className="text-sm opacity-70 mt-1">
              Add everyone in your family. We&rsquo;ll find every future window
              when all of you have prime ages at the same time.
            </p>
            <p className="text-xs opacity-50 mt-2">
              Everything runs in your browser. Nothing is sent or stored.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {drafts.map((d, idx) => (
              <div key={d.id} className="flex flex-wrap gap-2 items-center">
                <label className="sr-only" htmlFor={`${formId}-name-${d.id}`}>
                  Name for member {idx + 1}
                </label>
                <input
                  id={`${formId}-name-${d.id}`}
                  type="text"
                  placeholder="Name"
                  value={d.name}
                  onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                  className="input input-bordered w-40"
                />
                <label className="sr-only" htmlFor={`${formId}-date-${d.id}`}>
                  Birthday for member {idx + 1}
                </label>
                <input
                  id={`${formId}-date-${d.id}`}
                  type="date"
                  value={d.birthDate}
                  onChange={(e) =>
                    updateDraft(d.id, { birthDate: e.target.value })
                  }
                  className="input input-bordered"
                />
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDraft(d.id)}
                    aria-label={`Remove member ${idx + 1}`}
                    className="btn btn-ghost btn-sm btn-square"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={addDraft} className="btn btn-ghost">
              + Add member
            </button>
            <button
              type="button"
              onClick={calculate}
              className="btn btn-primary"
            >
              Find prime moments
            </button>
          </div>

          {error && (
            <div role="alert" className="alert alert-warning">
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {results && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">
            {totalMoments === 0
              ? "No prime moments found."
              : `Found ${totalMoments} prime moment${totalMoments === 1 ? "" : "s"} across ${results.length} constellation${results.length === 1 ? "" : "s"}.`}
          </h3>

          <div className="flex flex-col gap-4">
            {results.map((c) => (
              <div
                key={c.offsets.join(",")}
                className="card bg-base-200 border border-base-300"
              >
                <div className="card-body">
                  <h4 className="card-title text-lg">
                    Constellation [{c.offsets.join(", ")}]
                    <span className="text-sm font-normal opacity-60">
                      &mdash; {c.moments.length} occurrence
                      {c.moments.length === 1 ? "" : "s"}
                    </span>
                  </h4>

                  <ul className="flex flex-col gap-2 mt-2">
                    {c.moments.map((m) => (
                      <li
                        key={`${m.startDate}-${m.endDate}`}
                        className="bg-base-100 rounded p-3 border border-base-300"
                      >
                        <div className="font-medium">
                          {formatDate(m.startDate)} &rarr; {formatDate(m.endDate)}
                        </div>
                        <div className="text-sm opacity-70 mt-1">
                          {m.ages.map((a, i) => (
                            <span key={a.name}>
                              {i > 0 && ", "}
                              {a.name}:{" "}
                              <span className="font-semibold opacity-100">
                                {a.age}
                              </span>
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
