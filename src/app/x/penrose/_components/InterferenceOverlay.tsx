"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { facesInViewport, GAMMA, type Rect } from "../explore/lib/pentagrid";
import type { Pt } from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-projector
// demo as a told story. Two copies of the SAME real tiling, centred on a sun. The play
// sequence: start in complete overlap (one tiling), turn the top copy a fifth of a turn
// about the sun, slide it down a hair. The interference pattern needs no annotation:
// where the copies agree the edges land on each other and draw once; where they
// disagree the doubled edges read as denser bands. One colour, so the moiré is density.
//
// HONEST BY CONSTRUCTION. Both layers are the SAME enumerator tiling, centred on a real
// sun vertex. A fifth-of-a-turn about the sun is exact: each edge's rotated image either
// lands on an original edge (agreement) or does not. Drawn as crisp SVG, non-scaling
// stroke, geometry instanced via <use>.
//
// The harness drives render(t) through the beats; reset returns to overlap, the
// slider scrubs. Stroke colours are CSS vars, so they invert with the theme.

const VIEW_HALF = 24; // data half-width shown in the frame
// The chosen turn about the sun: one fifth of a turn, clockwise. Same rotation
// as +288 deg, but animated as -72 so the top copy takes the short way around.
const TURN = (-72 * Math.PI) / 180;
const SLIDE: [number, number] = [0, -0.4]; // the downward nudge, in tile-edge units
// Rotation is about the sun (frame centre) and preserves distance, so the layer only has
// to cover the frame's diagonal plus the small slide.
const R_PATH = Math.ceil(VIEW_HALF * Math.SQRT2 + 3);
const OVER = R_PATH / VIEW_HALF;
const LAYER_OFFSET_PCT = ((1 - OVER) / 2) * 100;

// Beats of the play timeline.
const T_OVERLAP = 0.2; // hold complete overlap
const T_TURN = 0.7; // turn 0 -> -72 about the sun
const T_SLIDE = 0.95; // slide down, then rest on the finished pattern

const smooth = (e0: number, e1: number, x: number): number => {
  const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};
const keyP = (p: Pt) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
const edgeKey = (a: Pt, b: Pt) => {
  const ka = keyP(a), kb = keyP(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

// Find a sun near the origin, then build TWO edge paths (S-centred, y flipped): the edges
// whose 288-degree image lands on an original edge (agreement), and those whose image does
// not (veins). Same geometry the explorer runs.
function buildScene(): { agree: string; vein: string } {
  const seek = facesInViewport({ minX: -10, minY: -10, maxX: 10, maxY: 10 }, GAMMA);
  const inc = new Map<string, { pos: Pt; thick: number; total: number }>();
  for (const f of seek) {
    for (const c of f.corners as readonly Pt[]) {
      const k = keyP(c);
      const e = inc.get(k) ?? { pos: c, thick: 0, total: 0 };
      e.total++;
      if (f.type === "thick") e.thick++;
      inc.set(k, e);
    }
  }
  const suns = [...inc.values()]
    .filter((e) => e.total === 5 && e.thick === 5)
    .sort((a, b) =>
      Math.hypot(a.pos[0], a.pos[1]) - Math.hypot(b.pos[0], b.pos[1]) ||
      a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1]);
  const S: Pt = suns.length ? suns[0].pos : [0, 0];

  // edges over a region a touch larger than we draw, so rotated images are classifiable
  const pad = 4;
  const view: Rect = { minX: S[0] - R_PATH - pad, minY: S[1] - R_PATH - pad, maxX: S[0] + R_PATH + pad, maxY: S[1] + R_PATH + pad };
  const faces = facesInViewport(view, GAMMA);
  const set = new Set<string>();
  const edges: { a: Pt; b: Pt }[] = [];
  for (const f of faces) {
    const rel = (f.corners as readonly Pt[]).map((c) => [c[0] - S[0], c[1] - S[1]] as Pt);
    for (let i = 0; i < 4; i++) {
      const a = rel[i], b = rel[(i + 1) % 4];
      const k = edgeKey(a, b);
      if (set.has(k)) continue;
      set.add(k);
      edges.push({ a, b });
    }
  }
  const cs = Math.cos(TURN), sn = Math.sin(TURN);
  const rot = (p: Pt): Pt => [p[0] * cs - p[1] * sn, p[0] * sn + p[1] * cs];
  const seg = (a: Pt, b: Pt) => `M${a[0].toFixed(3)} ${(-a[1]).toFixed(3)}L${b[0].toFixed(3)} ${(-b[1]).toFixed(3)}`;
  const agree: string[] = [], vein: string[] = [];
  for (const e of edges) {
    const mid: Pt = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    if (Math.hypot(mid[0], mid[1]) > R_PATH + 1) continue; // only draw within the layer
    (set.has(edgeKey(rot(e.a), rot(e.b))) ? agree : vein).push(seg(e.a, e.b));
  }
  return { agree: agree.join(""), vein: vein.join("") };
}

export default function InterferenceOverlay() {
  const scene = useMemo(() => buildScene(), []);
  const topRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback((t: number) => {
    const top = topRef.current, c = containerRef.current;
    if (!top || !c) return;
    const angle = smooth(T_OVERLAP, T_TURN, t) * TURN; // 0 -> -72 about the sun
    const slide = smooth(T_TURN, T_SLIDE, t); // 0 -> 1 of the downward nudge
    const w = c.getBoundingClientRect().width || 1;
    const pxPerUnit = w / (2 * VIEW_HALF);
    const ox = SLIDE[0] * slide, oy = SLIDE[1] * slide;
    top.style.transform = `translate(${ox * pxPerUnit}px, ${-oy * pxPerUnit}px) rotate(${(angle * 180) / Math.PI}deg)`;
  }, []);

  const lastT = useRef(1);
  const renderKeep = useCallback((t: number) => { lastT.current = t; render(t); }, [render]);

  useEffect(() => {
    renderKeep(lastT.current);
    const onResize = () => render(lastT.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [render, renderKeep]);

  const viewBox = `${-R_PATH} ${-R_PATH} ${2 * R_PATH} ${2 * R_PATH}`;
  const layer: React.CSSProperties = { position: "absolute", left: `${LAYER_OFFSET_PCT}%`, top: `${LAYER_OFFSET_PCT}%`, width: `${OVER * 100}%`, height: `${OVER * 100}%`, pointerEvents: "none" };
  const geom = { fill: "none", strokeLinejoin: "round" as const, strokeLinecap: "round" as const, vectorEffect: "non-scaling-stroke" as const };
  const inkStroke = { stroke: "var(--color-ink)", strokeWidth: 0.75, strokeOpacity: 0.8 };

  return (
    <Sketch
      label="sketch 09 · two tilings, one turned over the other"
      animation={{ duration: 9000, render: renderKeep, slider: { label: "scrub" } }}
    >
      {/* the two edge classes, defined once, instanced by both layers */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <path id="ov-agree" d={scene.agree} {...geom} />
          <path id="ov-vein" d={scene.vein} {...geom} />
        </defs>
      </svg>
      <div ref={containerRef} className="relative w-full overflow-hidden bg-paper" style={{ aspectRatio: "1 / 1" }} role="img"
        aria-label="Two copies of the same real Penrose tiling, one colour, centred on a sun. The animation starts in complete overlap (a single tiling), turns the top copy a fifth of a turn about the sun, and slides it down slightly. Where the copies agree their edges land on each other and draw once; where they disagree the doubled edges read as denser bands, so bright islands of agreement emerge separated by darker bands, the whole network five-fold. The two tilings share every finite patch yet never align everywhere at once, which is what Penrose saw on his overhead projector.">
        <svg style={layer} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <use href="#ov-agree" {...inkStroke} />
          <use href="#ov-vein" {...inkStroke} />
        </svg>
        <svg ref={topRef} style={{ ...layer, transformOrigin: "center", willChange: "transform" }} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <use href="#ov-agree" {...inkStroke} />
          <use href="#ov-vein" {...inkStroke} />
        </svg>
      </div>
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          Press play: the two copies start in perfect overlap, one clean tiling. Turn the
          top one a fifth of a turn about the sun, slide it a hair, and a new pattern
          emerges on its own.
        </p>
        <p className="mt-2 opacity-70">
          Where the copies agree, their edges land on each other and draw once: those are
          the bright islands. Where they disagree, the doubled edges read as denser bands
          between the islands. The whole network carries the same five-fold symmetry as
          the tiles.
        </p>
      </div>
    </Sketch>
  );
}
