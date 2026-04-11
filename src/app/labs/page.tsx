import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Labs — func.lol",
  description: "Lab experiments by Functionally Imperative.",
};

type Lab = {
  slug: string;
  title: string;
  blurb: string;
  publishedAt: string; // ISO date
  links?: {
    substack?: string;
    youtube?: string;
    github?: string;
  };
};

const labs: Lab[] = [
  {
    slug: "prime-moments",
    title: "Prime Moments",
    blurb:
      "Find the calendar windows when every member of your family has a prime age at the same time.",
    publishedAt: "2026-04-10",
    links: {
      github:
        "https://github.com/funcimp/func.lol/tree/main/research/prime-moments",
    },
  },
];

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function LabsIndexPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="text-sm opacity-60 hover:opacity-100 transition"
          >
            ← func.lol
          </Link>
          <h1 className="text-4xl font-bold">func imp labs</h1>
          <p className="text-lg opacity-80">
            Small, self-contained experiments. Built in public.
          </p>
        </header>

        <ul className="flex flex-col gap-4">
          {labs.map((lab) => (
            <li key={lab.slug}>
              <Link
                href={`/labs/${lab.slug}`}
                className="card bg-base-200 border border-base-300 hover:border-base-content/30 transition block"
              >
                <div className="card-body">
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <h2 className="card-title text-2xl">{lab.title}</h2>
                    <time
                      dateTime={lab.publishedAt}
                      className="text-sm opacity-60"
                    >
                      {formatDate(lab.publishedAt)}
                    </time>
                  </div>
                  <p className="opacity-80 mt-1">{lab.blurb}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
