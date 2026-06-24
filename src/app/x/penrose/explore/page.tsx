import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import PenroseExplorer from "./PenroseExplorer";

export const metadata: Metadata = {
  title: "Penrose Explorer — func.lol",
  description: "A bounded, exactly-addressed Penrose patch from a cut-and-project / substitution engine.",
};

export default function PenroseExplorePage() {
  return (
    <main className="h-dvh flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink/15">
        <Link
          href="/x/penrose"
          className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
        >
          ← penrose
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex-1 min-h-0">
        <PenroseExplorer />
      </div>
    </main>
  );
}
