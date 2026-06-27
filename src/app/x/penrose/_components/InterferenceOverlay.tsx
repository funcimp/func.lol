"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { facesInViewport, GAMMA, type Rect } from "../explore/lib/pentagrid";
import type { Pt } from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-projector
// demo, done honestly for a five-fold tiling. The only meaningful relative rotations are
// the tiling's own symmetry rotations, so the frame is centred on a SUN (five fat rhombi
// meeting at their 72-degree corners) and the top copy turns in 72-degree steps about it.
// At each step the sun stays identical while the rest no longer matches, so interference
// blooms outward from the sun. A small offset (drag, or the play-loop orbit) shifts the
// registry and makes the patterns drift. Both copies are one colour, so the moiré reads
// as line density, not two tinted layers.
//
// HONEST BY CONSTRUCTION. Both layers are the SAME real enumerator tiling, centred on a
// real sun vertex found in that tiling. A 72-degree turn about the sun leaves its flower
// invariant and creates the moiré elsewhere (verified: a solid invariant core plus broad
// islands of agreement and veins of mismatch). Nothing is tinted; the pattern is two real
// Penrose tilings overlapping. Drawn as crisp SVG with a non-scaling stroke; the edges are
// defined once and instanced by both layers via <use>.
//
// The harness drives render(t): play runs a seamless offset-orbit (the bloom/drift), reset
// returns to the sun-aligned state. The five-stop control picks the discrete turn. Stroke
// colour is a CSS var, so it inverts with the theme.

const VIEW_HALF = 24; // data half-width shown in the frame
const OFFSET_MAX = 8; // manual drag range, in tile-edge units
const DRIFT_R = 3; // play-loop offset-orbit radius, in tile-edge units
const STEP = (2 * Math.PI) / 5; // 72 degrees: the sun's symmetry rotation
const STEPS = [0, 1, 2, 3, 4]; // the five meaningful turns, k * 72 degrees
const DEFAULT_STEP = 1; // mount on a turned (interfering) state, not the coincident one
// The layer SVG is bigger than the frame and centred on the sun, so turning + offsetting
// pulls off-frame tiling into view; the frame (overflow hidden) clips the layer's edge.
const R_PATH = Math.ceil(VIEW_HALF * Math.SQRT2 + OFFSET_MAX + DRIFT_R * 2 + 2);
const OVER = R_PATH / VIEW_HALF;
const LAYER_OFFSET_PCT = ((1 - OVER) / 2) * 100;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
const keyP = (p: Pt) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

// Find a sun (five thick rhombi at one vertex) near the origin, then build one <path> of
// the surrounding tiling's deduped edges in coordinates centred on that sun (y flipped).
function buildScene(): string {
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

  const view: Rect = { minX: S[0] - R_PATH - 2, minY: S[1] - R_PATH - 2, maxX: S[0] + R_PATH + 2, maxY: S[1] + R_PATH + 2 };
  const faces = facesInViewport(view, GAMMA);
  const seen = new Set<string>();
  const parts: string[] = [];
  const r = (v: number) => Math.round(v * 1000);
  for (const f of faces) {
    const rel = (f.corners as readonly Pt[]).map((c) => [c[0] - S[0], c[1] - S[1]] as Pt);
    const cx = (rel[0][0] + rel[1][0] + rel[2][0] + rel[3][0]) / 4;
    const cy = (rel[0][1] + rel[1][1] + rel[2][1] + rel[3][1]) / 4;
    if (Math.hypot(cx, cy) > R_PATH + 1) continue;
    for (let i = 0; i < rel.length; i++) {
      const a = rel[i], b = rel[(i + 1) % rel.length];
      const ka = `${r(a[0])},${r(a[1])}`, kb = `${r(b[0])},${r(b[1])}`;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(k)) continue;
      seen.add(k);
      parts.push(`M${a[0].toFixed(3)} ${(-a[1]).toFixed(3)}L${b[0].toFixed(3)} ${(-b[1]).toFixed(3)}`);
    }
  }
  return parts.join("");
}

export default function InterferenceOverlay() {
  const path = useMemo(() => buildScene(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<SVGSVGElement>(null);
  const [step, setStep] = useState(DEFAULT_STEP);
  const stepRef = useRef(DEFAULT_STEP);
  const driftRef = useRef<[number, number]>([0, 0]); // play-loop orbit
  const manualRef = useRef<[number, number]>([0, 0]); // user drag, added on top

  // Apply the current turn (k * 72 deg about the sun = frame centre) plus the slide.
  const applyTransform = useCallback(() => {
    const top = topRef.current, c = containerRef.current;
    if (!top || !c) return;
    const w = c.getBoundingClientRect().width || 1;
    const pxPerUnit = w / (2 * VIEW_HALF);
    const ox = driftRef.current[0] + manualRef.current[0];
    const oy = driftRef.current[1] + manualRef.current[1];
    const deg = (stepRef.current * STEP * 180) / Math.PI;
    top.style.transform = `translate(${ox * pxPerUnit}px, ${-oy * pxPerUnit}px) rotate(${deg}deg)`;
  }, []);

  const setTurn = useCallback((k: number) => {
    stepRef.current = k;
    setStep(k);
    applyTransform();
  }, [applyTransform]);

  // play loops a seamless offset-orbit at the current turn: the patterns bloom and drift.
  const render = useCallback(
    (t: number) => {
      const a = 2 * Math.PI * t;
      driftRef.current = [DRIFT_R * (Math.cos(a) - 1), DRIFT_R * Math.sin(a)];
      applyTransform();
    },
    [applyTransform],
  );

  // Pointer drag adds a manual slide; pixel deltas convert to tile-edge units.
  const dragging = useRef(false);
  const last = useRef<[number, number]>([0, 0]);
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    last.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const w = e.currentTarget.getBoundingClientRect().width || 1;
      const pxPerUnit = w / (2 * VIEW_HALF);
      const dx = (e.clientX - last.current[0]) / pxPerUnit;
      const dy = -(e.clientY - last.current[1]) / pxPerUnit;
      last.current = [e.clientX, e.clientY];
      manualRef.current = [clamp(manualRef.current[0] + dx, OFFSET_MAX), clamp(manualRef.current[1] + dy, OFFSET_MAX)];
      applyTransform();
    },
    [applyTransform],
  );
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    applyTransform();
    const onResize = () => applyTransform();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyTransform]);

  const viewBox = `${-R_PATH} ${-R_PATH} ${2 * R_PATH} ${2 * R_PATH}`;
  const layer: React.CSSProperties = { position: "absolute", left: `${LAYER_OFFSET_PCT}%`, top: `${LAYER_OFFSET_PCT}%`, width: `${OVER * 100}%`, height: `${OVER * 100}%`, pointerEvents: "none" };

  return (
    <Sketch
      label="sketch 08 · two tilings, one turned over the other"
      animation={{ duration: 13000, render, loop: true, slider: { label: "offset" } }}
    >
      {/* edges defined once, instanced by both layers, so the path data lives once */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <path
            id="ov-edges"
            d={path}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={0.75}
            strokeOpacity={0.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </defs>
      </svg>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full overflow-hidden bg-paper"
        style={{ aspectRatio: "1 / 1", touchAction: "none", cursor: "grab" }}
        role="img"
        aria-label="Two copies of the same real Penrose tiling, one colour, overlaid and centred on a sun (five fat rhombi meeting at one vertex). The top copy turns in 72-degree steps about the sun. At each step the sun stays identical while the surrounding tiling no longer matches, so interference blooms outward: broad regions agree, veins of mismatch run between them, all five-fold. A small offset drag or the play-loop orbit shifts the registry and makes the patterns drift. Any two Penrose tilings share every finite patch yet never line up everywhere at once, which is what Penrose saw on his overhead projector."
      >
        <svg style={layer} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <use href="#ov-edges" />
        </svg>
        <svg ref={topRef} style={{ ...layer, transformOrigin: "center", willChange: "transform" }} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <use href="#ov-edges" />
        </svg>

        {/* the five meaningful turns: 72-degree pivots about the sun. Stop pointer events
            here so the container's drag/pointer-capture doesn't swallow the clicks. */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ink/40 bg-paper/70 px-3 py-1 backdrop-blur-sm"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-55">sun turn</span>
          {STEPS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTurn(k)}
              aria-label={`turn ${k * 72} degrees`}
              aria-pressed={step === k}
              title={`${k * 72}°`}
              className="grid h-4 w-4 place-items-center"
            >
              <span
                className="block h-2.5 w-2.5 rounded-full border border-ink transition-colors"
                style={{ backgroundColor: step === k ? "var(--color-ink)" : "transparent" }}
              />
            </button>
          ))}
          <span className="font-mono text-[10px] tabular-nums opacity-70" style={{ minWidth: "2.4em", textAlign: "right" }}>
            {step * 72}°
          </span>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[11px] opacity-70"
          style={{ color: "var(--color-ink)" }}
        >
          pick a 72° turn · press play to drift the offset · drag to slide
        </div>
      </div>
    </Sketch>
  );
}
