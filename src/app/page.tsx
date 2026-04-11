import Link from "next/link";

import FuncImpMark from "@/components/FuncImpMark";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[260px] opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--color-ink) 0.6px, transparent 1px)",
          backgroundSize: "3px 3px",
          maskImage:
            "radial-gradient(ellipse at bottom right, black 0%, transparent 65%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at bottom right, black 0%, transparent 65%)",
        }}
      />

      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-10">
        <ThemeToggle />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 gap-7">
        <FuncImpMark className="w-[260px] h-auto sm:w-[320px]" />
        <p className="text-[16px] opacity-85 max-w-[38ch] leading-[1.55]">
          Lab experiments by Functionally Imperative.
        </p>
        <Link
          href="/labs"
          className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 border border-ink no-underline hover:bg-ink/5"
        >
          enter the labs →
        </Link>
      </div>
    </main>
  );
}
