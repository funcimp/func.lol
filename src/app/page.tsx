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
        <h1 className="sr-only">func.lol</h1>
        <FuncImpMark className="w-[260px] h-auto sm:w-[320px]" />
        <p className="text-[14px] leading-[1.45] text-ink/55 max-w-[38ch]">
          <Link href="/x" className="underline text-ink hover:opacity-70">
            Experiments
          </Link>{" "}
          by{" "}
          <a
            href="https://n.2p5.xyz"
            className="underline text-ink hover:opacity-70"
            target="_blank"
            rel="noreferrer"
          >
            nathan toups
          </a>
          .
        </p>
      </div>
    </main>
  );
}
