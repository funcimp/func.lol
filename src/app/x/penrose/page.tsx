import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import { experimentNumber } from "../page";
import AddressWalk from "./_components/AddressWalk";
import CutAndProject from "./_components/CutAndProject";
import FibonacciStrip from "./_components/FibonacciStrip";
import GoldenRatio from "./_components/GoldenRatio";
import InterferenceOverlay from "./_components/InterferenceOverlay";
import MeetTheTiles from "./_components/MeetTheTiles";
import StopTilingByHand from "./_components/StopTilingByHand";
import UnsolvableFuture from "./_components/UnsolvableFuture";
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
            Two tiles cover the infinite plane and never repeat. Here is how, in
            order, ending at a plane you can walk.
          </p>
        </header>

        <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-55 flex gap-5 mb-9">
          <span>experiment {number}</span>
          <span>2026-05-11</span>
        </div>

        {/* 1. The question. */}
        <div className={PROSE}>
          <p>
            Take a bag of tiles. Lay them edge to edge across a floor that runs
            on forever, no gaps, no overlaps. Most tiles you can think of fall
            into a march: shift the pattern over by some fixed amount and it
            lands on itself, exact. Square tiles do it. Hexagons do it. The
            wallpaper in your hallway does it.
          </p>
          <p>
            So here is the question. Is there a set of tiles that covers the
            whole plane but <em>never</em> falls into that march? A pattern that
            keeps going forever and never once repeats itself? For a long time
            nobody knew.
          </p>
        </div>

        {/* 2. The history. */}
        <h2 className={H2}>Two tiles, after a long climb down</h2>
        <div className={PROSE}>
          <p>
            In 1961 Hao Wang asked a sharper version. He worked with square
            tiles whose edges carry colors, joined only where colors match. His
            conjecture: any such set that can tile the plane at all can also tile
            it periodically. If true, a tiling that never repeats was impossible.
          </p>
          <p>
            Wang was wrong. In 1966 his student Robert Berger built a set that
            tiles the plane and only ever aperiodically. The catch was the size.
            His first set used <strong>20,426</strong> tiles. Over the years that
            number fell. Berger himself trimmed it, Donald Knuth got it lower,
            Raphael Robinson reached <strong>six</strong> in 1971.
          </p>
          <p>
            Then in 1974 Roger Penrose reached <strong>two</strong>. Two simple
            rhombi, plus a rule about how their edges may meet. That is the floor
            this whole page stands on, and it is the one the explorer paints.
          </p>
        </div>

        {/* 3. How the two tiles work. */}
        <h2 className={H2}>The two tiles</h2>
        <div className={PROSE}>
          <p>
            Here they are. A <strong>thick</strong> rhombus, wide and squat, and
            a <strong>thin</strong> one, long and narrow. Same edge length,
            different angles. Every tile in the explorer is one of these two,
            rotated and dropped into place.
          </p>
          <p>
            The angles are not arbitrary. They come from fifths of a turn: 36,
            72, 108, 144. That family is the golden ratio φ in disguise. Draw the
            long diagonal of the thick rhombus and its length is exactly φ. Draw
            the short diagonal of the thin one and it is exactly 1/φ. φ is why
            these two shapes fit the plane with no repeat.
          </p>
        </div>

        <MeetTheTiles />

        {/* 4. A geometric dead-end: a piece fits, then strands you. */}
        <h2 className={H2}>A piece fits, and still strands you</h2>
        <div className={PROSE}>
          <p>
            Start with the gentle version, and make it airtight. Carve a small
            hole out of a real patch, six edges, and try to fill it back. This
            hole has exactly one filling. One. Watch the constrained edge: two
            different rhombi fit it with no overlap at all, so both look fine.
          </p>
          <p>
            The sketch below takes the tempting one and seats it cleanly. It
            fits. But it fills the hole the wrong way. What it leaves, shown in
            red, is two triangles, and no rhombus fits a triangle. No rule was
            invoked to say so. Only the other first move completes the hole, and
            the shapes alone tell you which.
          </p>
        </div>

        <StopTilingByHand />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            On the open plane the bare shapes never trap you like this; they would
            tile, boringly, forever. That is exactly why Penrose added the
            matching marks. Inside a bounded hole the geometry can speak for
            itself, and here it does: the gap is empty space you can see, not a
            rule you have to take on faith.
          </p>
        </div>

        {/* 5. Deeper: the move an expert says fits, followed through. */}
        <h2 className={H2}>The thin fits. Place it. Now nothing fits.</h2>
        <div className={PROSE}>
          <p>
            Here is the hard one, and it answers the obvious objection. Take a
            bigger hole, sixteen edges, carved from a real patch. A Penrose
            expert looks at one edge and says, rightly, a thin rhombus fits
            there. It does. Zero overlap. The piece sits in the gap.
          </p>
          <p>
            So place it. Lay a few more legal tiles, all fine, then fill in the
            rest of the hole as far as the shapes allow. Tiles still cannot cover
            everything. A gap is left, shown in red, that no rhombus fits. The
            thin fit, you placed it, you filled the rest, and the red gap remains.
            Not because a rule says no. Because the shapes collide. Out of all the
            ways to start, only one survives to finish the hole.
          </p>
        </div>

        <UnsolvableFuture />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            A move can fit and still doom you, and whether it does is not
            something the edge in front of you can tell. Only one continuation
            survives, and nothing local points to it. The fix is not a smarter
            local move. It is to stop tiling by hand and compute the plane
            globally.
          </p>
        </div>

        {/* 6. So you solve it globally. */}
        <h2 className={H2}>So you stop tiling by hand</h2>
        <div className={PROSE}>
          <p>
            If laying tiles one at a time can dead-end, stop laying them one at a
            time. Compute the whole plane at once, with a method called{" "}
            <strong>cut and project</strong>. It is easiest to see one dimension
            down, so start there. Take the integer grid in the plane. Draw a line
            through it at the golden slope, and a thin strip along the line. Keep
            only the points that fall inside the strip, and drop each one straight
            down onto the line.
          </p>
        </div>

        <FibonacciStrip />

        <div className={PROSE}>
          <p>
            Those dropped points tile the line with just two gaps, long and short,
            in the ratio φ, in an order that never repeats. <em>Cut</em> is the
            strip. <em>Project</em> is the drop. That is the whole method, and the
            two lengths are already a hint of the two tiles to come.
          </p>
          <p>
            Penrose is this same construction one stage up. The grid is the
            integer lattice ℤ⁵, five dimensions. The line becomes our plane, and
            the strip becomes a window shaped like four nested pentagons. A tile
            exists exactly when its 5D shadow lands in that window, a test you run
            on one point alone, with no walking out from an origin and no
            backtracking. The plane is <em>computed</em>, never assembled, so it
            can never dead-end. This is what the explorer runs.
          </p>
        </div>

        <CutAndProject />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            The dead-ends came from deciding locally. Here every tile is decided
            by where its 5D shadow falls, a test that never traps you, and that
            same coordinate is the address the explorer reads under your cursor.
          </p>
        </div>

        {/* 7. The overlay. */}
        <h2 className={H2}>Slide one over another</h2>
        <div className={PROSE}>
          <p>
            Penrose noticed something when he laid two of these tilings over each
            other on his overhead projector and turned one across the other.
            Large regions snap into agreement, the two patterns locking tile for
            tile. Between those islands run shifting veins where they disagree,
            and the whole map is organized by the same five-fold symmetry that
            built the tiles. Spin the top layer below a full turn, or drag it
            around, and watch the rosettes bloom and drift.
          </p>
        </div>

        <InterferenceOverlay />

        <div className={PROSE}>
          <p>
            Overlay two of these tilings and turn one, and you see broad regions
            agree while veins of mismatch ripple between them, organized by the
            five-fold symmetry. That is the strange part. Any two Penrose tilings
            share every finite patch you could name. Whatever stretch you see in
            one, you will find an exact copy somewhere in the other. Yet slide and
            rotate all you like, the two never line up everywhere at once.
            Infinitely alike up close, never the same as a whole. This is what
            Penrose saw on his projector.
          </p>
        </div>

        {/* 8. A coordinate system: the address is a walk along five directions. */}
        <h2 className={H2}>Every tile knows its address</h2>
        <div className={PROSE}>
          <p>
            Because every tile is the shadow of one lattice point, every tile
            carries that point as a name: five integers, exact, no two tiles
            alike. And the five integers are not an arbitrary code. Each one
            counts steps along one of five fixed directions, the very directions
            the tile edges run along. Walk those steps out from the origin and you
            arrive at the tile. The address is a path you can trace.
          </p>
        </div>

        <AddressWalk />

        <div className={PROSE}>
          <p>
            That is the trick that makes the explorer possible. Move anywhere,
            zoom anywhere, and the tile under your cursor can tell you precisely
            where you are, by reading its own address off the lattice. It is a
            full coordinate system for a floor with no edges. A shared link is
            just those five numbers, and it drops the next person on the exact
            same tile.
          </p>
        </div>

        {/* 9. More magic: scaling. */}
        <h2 className={H2}>It folds into itself</h2>
        <div className={PROSE}>
          <p>
            One more piece of magic. Take any valid Penrose tiling and cut each
            tile into smaller rhombi by a fixed rule. What you get is another
            valid Penrose tiling, finer, scaled down by φ. Run the rule backward
            and tiles fuse into bigger ones, a coarser valid tiling scaled up by
            φ. You can do this forever in either direction.
          </p>
          <p>
            Count the tiles as you go and a number falls out. Step the level
            deeper below and watch the running count of thick tiles to thin
            tiles. It homes in on φ, the same golden ratio that set the angles in
            the first place.
          </p>
        </div>

        <GoldenRatio />

        <div className={PROSE}>
          <p>
            The reason is the same self-similarity, seen the other way. Those
            smaller tiles are not just finer, they group back into larger tiles of
            the very same two shapes. Below, the filled rhombi are a real deflated
            patch and the bold outlines are the genuine level up, the supertiles
            the small ones compose into, the same two shapes scaled by φ. Scrub the
            depth and watch a level dissolve into the next: the supertiles fill in
            and become the pattern, while a fresh level up appears in outline.
          </p>
          <p>
            Inflate or deflate as far as you like and you always land on another
            valid Penrose tiling, scaled by φ. The pattern that never repeats is,
            at every scale, a copy of itself.
          </p>
        </div>

        <ZoomHierarchy />

        {/* 10. The explorer. */}
        <h2 className={H2}>Now walk it</h2>
        <div className={PROSE}>
          <p>
            The explorer generates whatever patch you are looking at on the fly,
            from the cut-and-project method, so you can pan in any direction
            forever. There is no edge to reach. Every tile carries its exact
            coordinate, shown under the cursor, and any view is a link you can
            share.
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
            research
          </h2>
          <div className={PROSE}>
            <p>
              Five substrate questions decided before any explorer code landed:
              precision drift of Float64 vs BigInt, URL share-link encoding,
              enumeration throughput, the BigInt-truth / Float64-view
              viewport-anchor pattern, and a Go comparison. The findings inform
              the engine and its addressing.
            </p>
            <p>
              <a
                href={RESEARCH_URL}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                research on github →
              </a>
            </p>
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
