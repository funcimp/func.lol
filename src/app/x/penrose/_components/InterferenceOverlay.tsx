"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { buildOverlay, type Pt } from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-projector
// demo. Two copies of the SAME real Penrose tiling are drawn as line work in ONE colour;
// turn or drag the top copy and the places where the two disagree organise into
// five-fold rosettes that bloom and drift. One colour is the point: the interference is
// emergent, read as varying line density where the two meshes agree or fight, not as two
// tinted layers laid on top of each other.
//
// HONEST BY CONSTRUCTION. Both layers are the SAME enumerator patch (lib/overlay.ts and
// its test); nothing is tinted, the moiré is just two real tilings overlapping. Drawn as
// crisp SVG: each layer is one <path> of the patch's deduped edges (shared edges drawn
// once, so overlaps never double-darken). The top layer is a separate SVG transformed
// with a GPU-composited CSS transform, so a rigid turn or slide stays sharp and smooth.
//
// The harness drives render(t): play runs a seamless loop where the turn breathes and the
// slide orbits, so the rosettes bloom and drift; reset/mount rest on a calm mid state.
// Pointer drag adds a manual slide on top. Stroke colour is a CSS var, so it inverts with
// the theme for free.

const VIEW_HALF = 36; // data half-width shown in the frame (zoomed out: tiles ~half size)
const OFFSET_MAX = 8; // how far the top layer may be dragged, in tile-edge units
// The play loop drives a seamless moiré: the turn BREATHES through a small range so the
// rosettes bloom from broad to fine and back, while the slide ORBITS so the registry
// knots drift. Both are periodic in t and return to the start, so play loops forever and
// reset/mount land on a calm mid state with the interference already visible.
const TURN_MID = (18 * Math.PI) / 180; // resting turn (degrees -> rad)
const TURN_AMP = (16 * Math.PI) / 180; // breathe +-16 deg, so the turn ranges ~2..34 deg
const DRIFT_R = 3.5; // slide-orbit radius, in tile-edge units
// Each layer SVG is bigger than the frame and centred, so the off-frame tiling rotates
// or slides into view while the frame (overflow hidden) clips the layer's square edge.
// It must hold everything a turn + drag + orbit can bring into the frame.
const R_PATH = Math.ceil(VIEW_HALF * Math.SQRT2 + OFFSET_MAX + DRIFT_R * 2 + 2);
const OVER = R_PATH / VIEW_HALF; // layer size as a multiple of the frame
const LAYER_OFFSET_PCT = ((1 - OVER) / 2) * 100; // centre the oversized layer
const GEN_HALF = R_PATH + 4;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

// One <path> of the patch's edges, deduped (shared edges once), y flipped for SVG.
function buildEdgePath(): string {
  const faces = buildOverlay(GEN_HALF).a;
  const seen = new Set<string>();
  const parts: string[] = [];
  const r = (v: number) => Math.round(v * 1000);
  for (const f of faces) {
    if (Math.hypot(f.centroid[0], f.centroid[1]) > R_PATH + 1) continue;
    const c = f.corners;
    for (let i = 0; i < c.length; i++) {
      const a = c[i] as Pt, b = c[(i + 1) % c.length] as Pt;
      const ka = `${r(a[0])},${r(a[1])}`, kb = `${r(b[0])},${r(b[1])}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(`M${a[0].toFixed(3)} ${(-a[1]).toFixed(3)}L${b[0].toFixed(3)} ${(-b[1]).toFixed(3)}`);
    }
  }
  return parts.join("");
}

export default function InterferenceOverlay() {
  const path = useMemo(() => buildEdgePath(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<SVGSVGElement>(null);
  const twistRef = useRef(TURN_MID); // resting turn (t = 0 and t = 1)
  const driftRef = useRef<[number, number]>([0, 0]); // the play-loop orbit
  const manualRef = useRef<[number, number]>([0, 0]); // the user's drag, added on top

  // Apply the current turn + slide to the top layer as a composited CSS transform. The
  // slide is the play-loop orbit plus whatever the user has dragged.
  const applyTransform = useCallback(() => {
    const top = topRef.current, c = containerRef.current;
    if (!top || !c) return;
    const w = c.getBoundingClientRect().width || 1;
    const pxPerUnit = w / (2 * VIEW_HALF);
    const ox = driftRef.current[0] + manualRef.current[0];
    const oy = driftRef.current[1] + manualRef.current[1];
    const deg = (twistRef.current * 180) / Math.PI;
    top.style.transform = `translate(${ox * pxPerUnit}px, ${-oy * pxPerUnit}px) rotate(${deg}deg)`;
  }, []);

  const render = useCallback(
    (t: number) => {
      const a = 2 * Math.PI * t;
      twistRef.current = TURN_MID + TURN_AMP * Math.sin(a); // breathe the turn
      driftRef.current = [DRIFT_R * (Math.cos(a) - 1), DRIFT_R * Math.sin(a)]; // orbit the slide
      applyTransform();
    },
    [applyTransform],
  );

  // Pointer drag slides the top layer; pixel deltas convert to tile-edge units.
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
  // Each layer SVG is OVER times the frame, centred, so the frame (overflow hidden) clips it.
  const layer: React.CSSProperties = { position: "absolute", left: `${LAYER_OFFSET_PCT}%`, top: `${LAYER_OFFSET_PCT}%`, width: `${OVER * 100}%`, height: `${OVER * 100}%`, pointerEvents: "none" };
  return (
    <Sketch
      label="sketch 08 · two tilings, one turned over the other"
      animation={{ duration: 15000, render, loop: true, slider: { label: "phase" } }}
    >
      {/* The edges are defined once and instanced by both layers, so the big path data
          lives in the DOM a single time. */}
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
        aria-label="Two copies of the same real Penrose tiling drawn as line work in one colour and overlaid. The turn control rotates the top copy across one fifth of a turn, the fundamental range for a five-fold tiling, and dragging slides it. Where the two copies disagree the mismatch organises into five-fold rosettes that bloom and drift; where they agree the lines coincide. Drawn in a single colour so the interference reads as varying line density rather than two separate layers. Any two Penrose tilings share every finite patch yet never line up everywhere at once, which is what Penrose saw on his overhead projector."
      >
        <svg style={layer} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <use href="#ov-edges" />
        </svg>
        <svg ref={topRef} style={{ ...layer, transformOrigin: "center", willChange: "transform" }} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <use href="#ov-edges" />
        </svg>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[11px] opacity-70"
          style={{ color: "var(--color-ink)" }}
        >
          press play to watch the rosettes bloom and drift · drag to slide
        </div>
      </div>
    </Sketch>
  );
}
