import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import { experimentNumber } from "../page";
import AddressWalk from "./_components/AddressWalk";
import CutAndProject from "./_components/CutAndProject";
import EmergentPatterns from "./_components/EmergentPatterns";
import FibonacciStrip from "./_components/FibonacciStrip";
import GoldenRatio from "./_components/GoldenRatio";
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
            Two tiles cover the infinite plane and never repeat. The whole
            story, from the first question to a plane you can walk.
          </p>
        </header>

        <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-55 flex gap-5 mb-9">
          <span>experiment {number}</span>
          <span>2026-05-11</span>
        </div>

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
            more than once, and I still couldn&#39;t have told you <em>why</em>{" "}
            it works. That bugged me. So I dug in, with Claude as a
            collaborator: I asked questions, we built a sketch for every
            answer, and this page is what we learned, in the order I wish
            someone had explained it to me.
          </p>
        </div>

        {/* 1. The question. */}
        <h2 className={H2}>The question</h2>
        <div className={PROSE}>
          <p>
            Take a bag of tiles. Lay them edge to edge across a floor that runs
            on forever, no gaps, no overlaps. Most tiles you can think of fall
            into a march: shift the pattern over by some fixed amount and it
            lands on itself, exact. Square tiles do it. Hexagons do it. The
            wallpaper in your hallway does it.
          </p>
          <p>
            So here&#39;s the question. Is there a set of tiles that covers the
            whole plane but <em>never</em> falls into that march? A pattern that
            keeps going forever and never once repeats itself? For a long time,
            nobody knew.
          </p>
        </div>

        {/* 2. The history. */}
        <h2 className={H2}>Two tiles, after a long climb down</h2>
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
            can tile the plane at all can also tile it periodically. If true, a
            tiling that never repeats was impossible.
          </p>
          <p>
            Wang was wrong. In 1966 his student Robert Berger built a set that
            tiles the plane and only ever aperiodically. The catch was the size:
            his first set used <strong>20,426</strong> tiles. What I love is
            what happened next, a decade-long countdown. Berger himself trimmed
            it, Donald Knuth got it lower, Raphael Robinson reached{" "}
            <strong>six</strong> in 1971.
          </p>
          <p>
            Then Roger Penrose took it to <strong>two</strong>. His 1974 set
            still used six tiles, built from pentagons. Within two years he had
            the pair this page uses: two simple rhombi (equivalently, his kite
            and dart), plus a rule about how their edges may meet.{" "}
            <a
              href="https://www.scientificamerican.com/article/mathematical-games-1977-01/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Martin Gardner&#39;s January 1977 column
            </a>{" "}
            made them famous. Those two tiles are the floor this whole page
            stands on, and the one the explorer paints.
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
            The angles aren&#39;t arbitrary. They come from fifths of a turn:
            36, 72, 108, 144. That family is the golden ratio φ in disguise.
            Draw the long diagonal of the thick rhombus and its length is
            exactly φ. Draw the short diagonal of the thin one and it is exactly
            1/φ. Here&#39;s the thing, though: the shapes alone aren&#39;t
            enough. Left to themselves, these two rhombi would happily tile the
            plane in a plain repeating pattern. It&#39;s Penrose&#39;s edge rule
            that outlaws every repeating arrangement, and φ, baked into the
            angles, is what leaves a non-repeating one possible at all. The
            coloured arcs drawn on the tiles below carry that rule: two tiles
            may share an edge only if the arcs continue across it, in colour and
            in position.
          </p>
        </div>

        <MeetTheTiles />

        {/* 3b. Lay them into a tiling: gentle on-ramp, proper colours, no structure. */}
        <h2 className={H2}>Lay them into a tiling</h2>
        <div className={PROSE}>
          <p>
            Drop the two tiles together by the thousands and they cover the plane:
            no gaps, every edge meeting an edge. Gold is the thick tile, teal the
            thin one, the colours we keep for the rest of the page. Hover any tile to
            check which it is.
          </p>
          <p>
            The catch is what&#39;s missing. There&#39;s no repeat. Slide this tiling any
            distance in any direction and it never lands back on itself. That&#39;s a{" "}
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
        <h2 className={H2}>Patterns start to surface</h2>
        <div className={PROSE}>
          <p>
            Sit with that tiling for a minute and patterns start to surface. First the{" "}
            <strong>rosettes</strong>: five-petal suns, where five thick tiles meet,
            scattered through the plane. Then the <strong>ribbons</strong>: long bands
            of tiles running clear across it in five directions, one per edge direction
            the tiles share.
          </p>
          <p>
            Switch between them below, and then try <strong>arcs</strong>: the
            matching-rule arcs from the two tiles, drawn on every tile at once.
            Watch them run across the edges unbroken and join into long winding
            strands. The bands are lit by dimming the rest of the
            tiling, so each one stays real tiles in their true colours. They are the
            skeleton the famous{" "}
            <a
              href="https://en.wikipedia.org/wiki/Robert_Ammann"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Ammann bars
            </a>{" "}
            trace, the straight lines hidden in any Penrose tiling.
          </p>
        </div>

        <EmergentPatterns />

        {/* 4. A geometric dead-end: a piece fits, then strands you. */}
        <h2 className={H2}>A piece fits, and still strands you</h2>
        <div className={PROSE}>
          <p>
            Now it gets sneaky. Start with the gentle version, and make it
            airtight. Carve a small hole out of a real patch, six edges, and try
            to fill it back. This hole has exactly one filling. One. Watch the
            constrained edge: two different rhombi fit it with no overlap at
            all, so both look fine.
          </p>
          <p>
            The sketch below takes the tempting one and seats it cleanly. It
            fits. But it fills the hole the wrong way. What it leaves, shown in
            red, is two triangles, and no rhombus fits a triangle. No rule was
            invoked to say so. Only the other first move completes the hole, and
            the shapes alone tell you which. And watch the arcs when the red
            appears: the tempting piece can&#39;t continue its neighbours&#39;
            arcs no matter how it&#39;s marked, while the right filling lets
            them flow straight through. The rule reaches the same verdict, at
            the moment the tile lands.
          </p>
        </div>

        <StopTilingByHand />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            On the open plane the bare shapes never trap you like this; they
            would tile, boringly, forever. That&#39;s exactly why Penrose added
            the matching marks. Inside a bounded hole the geometry can speak for
            itself, and here it does: the gap is empty space you can see, not a
            rule you have to take on faith.
          </p>
        </div>

        {/* 5. Deeper: the move an expert says fits, followed through. */}
        <h2 className={H2}>The thin fits. Place it. Now nothing fits.</h2>
        <div className={PROSE}>
          <p>
            Here&#39;s the hard one, and it answers the obvious objection. Take
            a bigger hole, sixteen edges, carved from a real patch. A Penrose
            expert looks at one edge and says, rightly, a thin rhombus fits
            there. It does. Zero overlap. The piece sits in the gap.
          </p>
          <p>
            So place it. Lay a few more legal tiles, all fine, then fill in the
            rest of the hole as far as the shapes allow. Tiles still can&#39;t cover
            everything. A gap is left, shown in red, that no rhombus fits. The
            thin fit, you placed it, you filled the rest, and the red gap remains.
            Not because a rule says no. Because the shapes collide. Out of all the
            ways to start, only one survives to finish the hole.
          </p>
        </div>

        <UnsolvableFuture />

        <div className={PROSE}>
          <p className="text-[14px] leading-[1.6] opacity-70">
            A move can fit and still doom you, and whether it does isn&#39;t
            something the edge in front of you can tell. Only one continuation
            survives, and nothing local points to it. The fix isn&#39;t a
            smarter local move. It&#39;s to stop tiling by hand and compute the
            plane globally.
          </p>
        </div>

        {/* 6. So you solve it globally. */}
        <h2 className={H2}>So you stop tiling by hand</h2>
        <div className={PROSE}>
          <p>
            If laying tiles one at a time can dead-end, stop laying them one at
            a time. The trick is a method called{" "}
            <strong>cut and project</strong>: compute the whole plane at once.
            It&#39;s easiest to see one dimension down, so start there. Take the
            integer grid in the plane. Draw a line through it at the golden
            slope, and a thin strip along the line. Keep only the points that
            fall inside the strip, and drop each one straight down onto the
            line.
          </p>
        </div>

        <FibonacciStrip />

        <div className={PROSE}>
          <p>
            Those dropped points tile the line with just two gaps, long and short,
            in the ratio φ, in an order that never repeats. <em>Cut</em> is the
            strip. <em>Project</em> is the drop. That&#39;s the whole method, and
            the two lengths are already a hint of the two tiles to come.
          </p>
          <p>
            Here&#39;s the part I love: Penrose is this exact construction, one
            stage up. The grid is the integer lattice ℤ⁵, five dimensions. The
            line becomes our plane, and the strip becomes a window shaped like
            nested pentagons. A tile exists exactly when its 5D shadow lands in
            that window, a test you run on one point alone, with no
            backtracking. Each tile is decided on its own, so the plane is{" "}
            <em>computed</em>, never assembled, and it can never dead-end. The
            next sketches show how that plays out on the plane. This is what the
            explorer runs.
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
        <h2 className={H2}>Where the dead-ends come from</h2>
        <div className={PROSE}>
          <p>
            The window also explains the trap. Run the test backward. When you
            tile by hand you don&#39;t know where the window sits, and every
            tile you lay is a clue: the window must be somewhere that accepts
            every tile placed so far.
          </p>
          <p>
            The sketch below tracks those clues. On the left, tiles go down by
            hand. On the right, the shaded region is every place the window
            could still sit. Correct tiles shrink the region but never empty
            it, because the true window is always inside. Then the tempting
            tile lands, the one that fits with no overlap, and the region
            collapses to nothing. No window anywhere accepts that patch, so it
            can never be finished. That&#39;s what stranding is. Cut and project
            never gets trapped because it fixes the window first and asks every
            tile the same question.
          </p>
        </div>

        <WindowStrand />

        {/* 6c. The dual view: de Bruijn's pentagrid draws the tiles. */}
        <h2 className={H2}>The tiles fall out of a grid of lines</h2>
        <div className={PROSE}>
          <p>
            Cut and project tests one point at a time. There&#39;s a second way
            to see the same tiling, and it draws the whole thing at once. Take five
            families of evenly spaced parallel lines, one family running in each
            of the five pentagon directions. Lay them over each other and they
            cross everywhere.{" "}
            <a
              href="https://www.sciencedirect.com/science/article/pii/1385725881900160"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              de Bruijn proved
            </a>{" "}
            that every crossing is one tile.
            Where two families meet at a shallow angle you get a fat rhombus,
            where they meet at a steep angle you get a thin one.
          </p>
          <p>
            This is the same five dimensions, seen from the other side. Each
            crossing is one square face of the 5D cube lattice, and the rhombus
            on the plane is the shadow of that face. The tiles fall straight out of the
            grid. On the left below are the five line families and their crossings.
            On the right is the tiling, exactly one rhombus per crossing, with a
            line drawn from one crossing to the tile it becomes.
          </p>
        </div>

        <PentaGrid />

        <div className={PROSE}>
          <p>
            Nothing is placed by hand. Every crossing in view becomes a tile, and
            every tile is some crossing, so the grid and the tiling carry the same
            information. Cut and project and the pentagrid are two faces of one
            construction: project the lattice points that land in the window, or
            read off the crossings of its shadow. Both compute the same plane.
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
            built the tiles. Press play below: the two start in perfect overlap,
            the top turns a fifth about a sun and slides a hair, and the veins where
            they disagree light up.
          </p>
        </div>

        <InterferenceOverlay />

        <div className={PROSE}>
          <p>
            Here&#39;s the strange part. Any two Penrose tilings share every
            finite patch you could name: whatever stretch you find in one, an
            exact copy sits somewhere in the other. Yet no shift and no turn
            ever lines them up everywhere at once. Infinitely alike up close,
            never the same as a whole. That&#39;s what Penrose was looking at on
            his projector.
          </p>
        </div>

        {/* 8. A coordinate system: the address is a walk along five directions. */}
        <h2 className={H2}>Every tile knows its address</h2>
        <div className={PROSE}>
          <p>
            Because every tile is the shadow of one lattice point, every tile
            carries that point as a name: five integers, exact, no two tiles
            alike. And every edge of the tiling runs in one of five fixed
            directions, so you can walk to any tile along its edges. Trace the
            route below from a starting tile and watch it land on the addressed
            tile, right on the real boundaries.
          </p>
        </div>

        <AddressWalk />

        <div className={PROSE}>
          <p>
            That&#39;s the trick that makes the explorer possible. Move
            anywhere, zoom anywhere, and the tile under your cursor can tell you
            precisely where you are, by reading its own address off the lattice.
            It&#39;s a full coordinate system for a floor with no edges. A
            shared link is just those five numbers, and it drops the next person
            on the exact same tile.
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
            Count the fat tiles and the thin ones and stack them up. Below, the gold
            stack grows out to φ times the blue as you deflate, landing on the
            golden-ratio mark. The count of fat to thin tiles is the golden ratio,
            the same φ that set the angles in the first place.
          </p>
        </div>

        <GoldenRatio />

        <div className={PROSE}>
          <p>
            The reason is the same self-similarity, seen the other way. Those
            smaller tiles aren&#39;t just finer, they group back into larger tiles of
            the very same two shapes. Below, each deflation level is drawn as a line
            grid in its own colour, gold and blue alternating so neighbouring levels
            stay distinct. Zoom in and a finer grid nests inside every tile, the
            same two shapes 1/φ the size, diving level after level.
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
            The explorer generates whatever patch you&#39;re looking at on the
            fly, from the cut-and-project method, so you can pan in any
            direction forever. There&#39;s no edge to reach. Every tile carries
            its exact coordinate, shown under the cursor, and any view is a link
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
