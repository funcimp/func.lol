import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import { experimentNumber } from "../page";
import AddressWalk from "./_components/AddressWalk";
import CutAndProject from "./_components/CutAndProject";
import EmergentPatterns from "./_components/EmergentPatterns";
import FibonacciStrip from "./_components/FibonacciStrip";
import GoldenRatio from "./_components/GoldenRatio";
import HeaderTiling from "./_components/HeaderTiling";
import InterferenceOverlay from "./_components/InterferenceOverlay";
import MeetTheTiles from "./_components/MeetTheTiles";
import PentaGrid from "./_components/PentaGrid";
import StopTilingByHand from "./_components/StopTilingByHand";
import TilingIntro from "./_components/TilingIntro";
import UnsolvableFuture from "./_components/UnsolvableFuture";
import WindowStrand from "./_components/WindowStrand";
import ZoomHierarchy from "./_components/ZoomHierarchy";

export const metadata: Metadata = {
  title: "Penrose — func.lol",
  description:
    "How two tiles cover the infinite plane and never repeat, told in order, ending at an explorer you can pan forever where every tile names its exact coordinate.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/penrose";

// Shared classes for the section headings and the prose blocks, kept to the
// DESIGN.md scale (h2 28/32, body 16/1.65, prose max-width ~60ch).
const H2 =
  "text-[24px] sm:text-[32px] font-bold leading-[1.05] tracking-[-0.03em] mb-5 mt-16";
const PROSE =
  "prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]";

export default function PenrosePage() {
  // The badge number is derived from publication order, not hand-set: penrose is
  // the third experiment by date, so this reads "experiment 03" and stays correct
  // if the catalogue grows or reorders.
  const number = String(experimentNumber("penrose")).padStart(2, "0");
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/x"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← experiments
          </Link>
          <ThemeToggle />
        </div>

        <header className="mb-7">
          <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
            penrose
          </h1>
          <p className="text-[18px] leading-[1.45] opacity-85 max-w-[44ch] mt-3">
            An interactive exploration of Penrose tilings.
          </p>
        </header>

        <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-55 flex gap-5 mb-9">
          <span>experiment {number}</span>
          <span>2026-05-11</span>
        </div>

        <HeaderTiling />

        {/* 0. The narrator: why this page exists. */}
        <div className={PROSE}>
          <p>
            I&#39;ve been fascinated by Penrose tilings for years. Two shapes
            that cover an infinite floor and never repeat the same pattern? I
            watched{" "}
            <a
              href="https://www.youtube.com/watch?v=th3YMEamzmw"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Penrose himself
            </a>{" "}
            lecture on them, watched the{" "}
            <a
              href="https://www.veritasium.com/videos/2020/9/30/the-infinite-pattern-that-never-repeats"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Veritasium video
            </a>{" "}
            more than once, and I knew that I had so much more to learn. So I
            dug in and built this sketch to explore the topic and share what
            I&#39;ve learned.
          </p>
          <p>
            So here&#39;s the question. Is there a set of tiles that covers the
            whole plane but <em>never</em> repeats? For a long time, nobody
            knew.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/x/penrose/explore"
            className="inline-block font-mono text-[12px] uppercase tracking-[0.14em] border border-ink px-4 py-2 no-underline hover:bg-ink hover:text-paper transition-colors"
          >
            open explorer →
          </Link>
        </div>

        {/* 2. The history. */}
        <h2 className={H2}>A little history</h2>
        <div className={PROSE}>
          <p>
            In 1961 Hao Wang asked a sharper version. He worked with{" "}
            <a
              href="https://en.wikipedia.org/wiki/Wang_tile"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              square tiles whose edges carry colors
            </a>
            , joined only where colors match. His conjecture: any such set that
            can tile the plane at all can also tile it periodically. If true, no
            tile set could ever force non-repetition.
          </p>
          <p>
            Wang was wrong. In 1966 his student Robert Berger built a set that
            tiles the plane and only ever aperiodically, using{" "}
            <strong>20,426</strong> tiles. What I love is what happened next, a
            decade-long countdown: Berger trimmed it, Donald Knuth got it lower,
            Raphael Robinson reached <strong>six</strong> in 1971.
          </p>
          <p>
            Then Roger Penrose took it to <strong>two</strong>: first a kite and
            a dart, then the two simple rhombi this page uses, plus a rule about
            how their edges may meet.{" "}
            <a
              href="https://www.scientificamerican.com/article/mathematical-games-1977-01/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Martin Gardner&#39;s January 1977 column
            </a>{" "}
            made them famous.
          </p>
        </div>

        {/* 3. How the two tiles work. */}
        <h2 className={H2}>The two tiles</h2>
        <div className={PROSE}>
          <p>
            A <strong>thick</strong> rhombus, wide and squat, and
            a <strong>thin</strong> one, long and narrow. Same edge length,
            different angles. Every tile in the explorer is one of these two,
            rotated and dropped into place.
          </p>
          <p>
            The angles come from tenths of a turn: 36, 72, 108, 144, and that
            family is the golden ratio φ (pronounced &#8220;fye,&#8221; rhymes
            with pie) in disguise: the thick tile&#39;s long diagonal is exactly
            φ, the thin one&#39;s short diagonal exactly 1/φ. Here&#39;s the thing, though: the shapes alone aren&#39;t
            enough. Left to themselves they&#39;d happily tile the plane in a
            plain repeating pattern. It&#39;s Penrose&#39;s edge rule that
            forbids every repeating arrangement, and the coloured arcs below
            carry that rule: two tiles may share an edge only if the arcs
            continue across it, in colour and in position.
          </p>
        </div>

        <MeetTheTiles />

        {/* 3b. Lay them into a tiling: gentle on-ramp, proper colours, no structure. */}
        <h2 className={H2}>Tiling the plane</h2>
        <div className={PROSE}>
          <p>
            From here on, every sketch uses the same tile set: gold for the
            thick rhombus, teal for the thin. Press play below and watch the two
            tiles settle into a patch of the plane.
          </p>
          <p>
            What grows is a{" "}
            <a
              href="https://en.wikipedia.org/wiki/Quasicrystal"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              quasicrystal
            </a>{" "}
            pattern: fully ordered, but never periodic. Slide the finished
            tiling any distance in any direction and it never lands back on
            itself. That&#39;s a{" "}
            <a
              href="https://en.wikipedia.org/wiki/Penrose_tiling"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Penrose tiling
            </a>
            .
          </p>
        </div>

        <TilingIntro />

        {/* 3c. Patterns surface: rosettes and ribbons, on the same coloured tiling. */}
        <h2 className={H2}>Hidden patterns</h2>
        <div className={PROSE}>
          <p>
            The tiling hides structure you can surface one layer at a time.{" "}
            <strong>Rosettes</strong> are the five-petal suns where five thick
            tiles meet. <strong>Ribbons</strong> are bands of tiles that run
            across the whole plane, one family per edge direction, the skeleton
            the famous{" "}
            <a
              href="https://en.wikipedia.org/wiki/Robert_Ammann"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Ammann bars
            </a>{" "}
            trace. <strong>Arcs</strong> are the matching rule itself, drawn on
            every tile at once.
          </p>
          <p>
            Use the picker below to switch between the three. Watch the arcs
            especially: they cross every edge unbroken, proof at a glance that
            the whole patch is legal.
          </p>
        </div>

        <EmergentPatterns />

        {/* 4. A geometric dead-end: a piece fits, then strands you. */}
        <h2 className={H2}>Two examples of dead-ends</h2>
        <div className={PROSE}>
          <p>
            Now try laying tiles yourself. The first sketch carves a small
            hole, six edges, out of a real patch. This hole has exactly one
            correct filling, yet two different rhombi fit its constrained edge
            with no overlap. Both look fine.
          </p>
          <p>
            Press play and the sketch seats the tempting one. It fits, but what
            it leaves, shown in red, is two triangles, and no rhombus fits a
            triangle. No rule was invoked; the shapes alone decide. The arcs
            agree: no marking of the tempting piece continues its
            neighbours&#39; arcs, while the correct filling lets them flow
            through.
          </p>
        </div>

        <StopTilingByHand />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            On the open plane the bare shapes never have to strand, because the
            plain repeating pattern is always available. That&#39;s why Penrose
            added the matching marks. Inside a bounded hole that option is gone,
            so the shapes alone can show you the dead-end.
          </p>
        </div>

        {/* 5. Deeper: a move that looks fine, followed through to the trap. */}
        <div className={`${PROSE} mt-4`}>
          <p>
            The second sketch makes the same point with a bigger hole, sixteen
            edges. A thin rhombus fits one of its edges with zero overlap, and
            nothing about the move looks wrong.
          </p>
          <p>
            Place it, fill in the rest as far as the shapes allow, and a red gap
            remains that no rhombus fits, not because a rule says no, but
            because the shapes collide. A move can look fine and still be a
            trap: of all the ways to start, only one finishes the hole.
          </p>
        </div>

        <UnsolvableFuture />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            A move can fit and still lead to a dead-end, and nothing nearby
            warns you. The fix isn&#39;t a smarter local move: it&#39;s to stop
            tiling by hand and compute the whole plane at once.
          </p>
        </div>

        {/* 6. So you solve it globally. */}
        <h2 className={H2}>Cut and project</h2>
        <div className={PROSE}>
          <p>
            The method is called <strong>cut and project</strong>, and the
            sketch below shows it one dimension down. Take the integer grid,
            draw a line through it at the golden slope, and keep only the
            points inside a thin strip around the line. Each kept point drops
            perpendicularly onto the line. Slide the strip and watch the
            selection change.
          </p>
        </div>

        <FibonacciStrip />

        <div className={PROSE}>
          <p>
            The dropped points tile the line with two gaps, long and short, in
            ratio φ, in an order that never repeats. <em>Cut</em> is the strip,{" "}
            <em>project</em> is the drop, and the two lengths are a hint of the
            two tiles to come.
          </p>
          <p>
            Here&#39;s the part I love: Penrose is this exact construction, one
            stage up. The grid is the integer lattice ℤ⁵, the line becomes our
            plane, and the strip becomes a window shaped like nested pentagons.
            A corner exists exactly when its 5D shadow lands in the window; a
            tile exists exactly when all four of its corners do. Every tile is
            decided on its own, no backtracking, so the plane is{" "}
            <em>computed</em>, never assembled, and it can never dead-end. Hover
            a tile below to watch its four corners land in the window.
          </p>
        </div>

        <CutAndProject />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            Keep hold of that 5D coordinate. It&#39;s not just bookkeeping:
            it&#39;s the address the explorer reads under your cursor, and it
            comes back at the end of the page.
          </p>
        </div>

        {/* 6b. The dead-ends, explained: the window region collapses. */}
        <h2 className={H2}>Why dead-ends happen</h2>
        <div className={PROSE}>
          <p>
            The window also explains the dead-ends. When you tile by hand you
            don&#39;t know where the window sits, and every tile you lay is a
            clue: it must be somewhere that accepts every tile placed so far.
          </p>
          <p>
            Press play below: tiles go down by hand on the left, while on the
            right the shaded region is every place the window could still sit.
            Correct tiles shrink it but never empty it. Then the tempting tile
            lands, the one that fits with no overlap, and the region collapses
            to nothing. That&#39;s what stranding is. Cut and project never gets
            trapped because it fixes the window first.
          </p>
        </div>

        <WindowStrand />

        {/* 6c. The dual view: de Bruijn's pentagrid draws the tiles. */}
        <h2 className={H2}>The pentagrid</h2>
        <div className={PROSE}>
          <p>
            There&#39;s a second way to see the same tiling, and it draws the
            whole thing at once. Take five families of evenly spaced parallel
            lines, one per pentagon direction, and lay them over each other.{" "}
            <a
              href="https://www.sciencedirect.com/science/article/pii/1385725881900160"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              de Bruijn proved
            </a>{" "}
            that every crossing is one tile: 72-degree crossings give fat
            rhombi, glancing 36-degree crossings give thin ones.
          </p>
          <p>
            It&#39;s the same five dimensions from the other side: each crossing
            is one square face of the 5D lattice, and the rhombus is that
            face&#39;s shadow. Press play below and watch every crossing on the
            left become its tile on the right.
          </p>
        </div>

        <PentaGrid />

        <div className={PROSE}>
          <p>
            Nothing is placed by hand: every crossing is a tile and every tile
            is a crossing, so the grid and the tiling carry the same
            information. Cut and project and the pentagrid are two faces of one
            construction.
          </p>
        </div>

        {/* 7. The overlay. */}
        <h2 className={H2}>Two tilings overlaid</h2>
        <div className={PROSE}>
          <p>
            Penrose noticed something on his overhead projector: lay two of
            these tilings over each other and turn one, and large regions snap
            into agreement while veins of disagreement ripple between them.
            Press play below: the top copy turns a fifth about a sun, slides a
            hair, and the veins light up.
          </p>
        </div>

        <InterferenceOverlay />

        <div className={PROSE}>
          <p>
            Here&#39;s the strange part. Any two Penrose tilings share every
            finite patch you could name, yet there are uncountably many
            genuinely different ones, tilings no shift or turn will ever line
            up. Infinitely alike up close, never the same as a whole.
          </p>
        </div>

        {/* 8. A coordinate system: the address is a walk along five directions. */}
        <h2 className={H2}>Every tile has an address</h2>
        <div className={PROSE}>
          <p>
            Every tile is the shadow of one square face of the lattice,
            so every tile carries a name: the five integers of its base corner
            plus which two directions span it. No two tiles share it. And since
            every edge runs in one of five fixed directions, you can walk to any
            tile along its edges. Trace the route below.
          </p>
        </div>

        <AddressWalk />

        <div className={PROSE}>
          <p>
            That&#39;s what makes the explorer possible: a full coordinate
            system for a floor with no edges. The tile under your cursor reads
            its own address off the lattice, and a shared link is just that
            name, seven small integers that drop the next person on the exact
            same tile.
          </p>
        </div>

        {/* 9. More magic: scaling. */}
        <h2 className={H2}>Self-similarity</h2>
        <div className={PROSE}>
          <p>
            Cut each tile into smaller rhombi by a fixed rule and you get
            another valid Penrose tiling, finer by a factor of φ. Run the rule
            backward and tiles fuse into a coarser one. It works forever in
            both directions.
          </p>
          <p>
            The first sketch counts tiles as you deflate: the gold stack grows
            out to φ times the teal. In the infinite tiling the ratio is
            exactly φ, which is its own proof of non-periodicity: a periodic
            tiling repeats some finite block, so its ratio would be a fraction,
            and φ is not.
          </p>
        </div>

        <GoldenRatio />

        <div className={PROSE}>
          <p>
            The second sketch draws each deflation level as a grid in its own
            colour. Zoom in and a finer grid nests inside every tile, the same
            two shapes at 1/φ the size, level after level: the pattern is, at
            every scale, a copy of itself.
          </p>
        </div>

        <ZoomHierarchy />

        {/* 10. The explorer. */}
        <h2 className={H2}>The explorer</h2>
        <div className={PROSE}>
          <p>
            The explorer generates whatever patch you&#39;re looking at on the
            fly, so you can pan forever: there&#39;s no edge to reach. Every
            tile shows its coordinate under the cursor, and any view is a link
            you can share. Go get lost in it.
          </p>
        </div>

        <div className="my-8">
          <Link
            href="/x/penrose/explore"
            className="inline-block font-mono text-[12px] uppercase tracking-[0.14em] border border-ink px-4 py-2 no-underline hover:bg-ink hover:text-paper transition-colors"
          >
            open explorer →
          </Link>
        </div>

        <div className="mt-16 pt-7 border-t border-ink">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-4">
            go deeper
          </h2>
          <div className={PROSE}>
            <p>
              Everything on this page is classical mathematics, rebuilt here
              under test. These are the sources I learned it from, roughly in
              the order I&#39;d hand them to a friend.
            </p>
            <ul className="flex flex-col gap-2 text-[15px] leading-[1.6]">
              <li>
                <a
                  href="https://www.veritasium.com/videos/2020/9/30/the-infinite-pattern-that-never-repeats"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Veritasium, The Infinite Pattern That Never Repeats
                </a>{" "}
                <span className="opacity-70">
                  · the best on-ramp there is, from Kepler to quasicrystals
                </span>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/watch?v=th3YMEamzmw"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Roger Penrose, Forbidden Crystal Symmetry
                </a>{" "}
                <span className="opacity-70">
                  · the Royal Institution lecture, the story from the man himself
                </span>
              </li>
              <li>
                <a
                  href="https://www.scientificamerican.com/article/mathematical-games-1977-01/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Martin Gardner, Mathematical Games, January 1977
                </a>{" "}
                <span className="opacity-70">
                  · the column that introduced the tiles to the world
                </span>
              </li>
              <li>
                <a
                  href="https://www.sciencedirect.com/science/article/pii/1385725881900160"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  N. G. de Bruijn, Algebraic theory of Penrose&#39;s
                  non-periodic tilings, 1981
                </a>{" "}
                <span className="opacity-70">
                  · the pentagrid and the window; the paper the explorer runs on
                </span>
              </li>
              <li>
                <a
                  href="https://arxiv.org/abs/2310.18950"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Francesco D&#39;Andrea, A Guide to Penrose Tilings, 2023
                </a>{" "}
                <span className="opacity-70">
                  · the modern book, free on arXiv, with every proof
                </span>
              </li>
              <li>
                <a
                  href={RESEARCH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  the research notes behind this page
                </a>{" "}
                <span className="opacity-70">
                  · our worked math, experiments, and what each result cites
                </span>
              </li>
            </ul>
          </div>
        </div>

        <footer className="mt-10 pt-5 border-t border-ink font-mono text-[11px] opacity-55 text-center">
          an experiment by{" "}
          <a
            href="https://n.2p5.xyz"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            nathan toups
          </a>
        </footer>
      </div>
    </main>
  );
}
