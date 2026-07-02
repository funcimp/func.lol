"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Sketch is the framed teaching primitive for the Penrose spine. It gives every
// sketch the same chrome (a mono label, a hairline border, no rounded corners per
// DESIGN.md) and, for animated sketches, the same controls and the same motion
// contract. The render area is the sketch's own canvas or SVG; the harness never
// paints, it only frames and (for animated sketches) drives a clock.
//
// Two kinds:
//
//   STATIC   <Sketch label="…">{svgOrCanvas}</Sketch>
//            No clock, no controls. May still be interactive via hover. Used for
//            "Meet the two tiles".
//
//   ANIMATED <Sketch label="…" animation={{ duration, render }}>…</Sketch>
//            The harness owns the requestAnimationFrame loop and renders a control
//            bar (play/pause, step, reset, optional slider). The sketch supplies
//            render(t): a paint function called with normalised time t in [0,1].
//
// Reduced-motion hard contract: nothing autoplays. On mount the harness paints the
// representative end state (t = 1) and never moves on its own. Under
// prefers-reduced-motion, play is disabled and motion happens only on an explicit
// slider drag or step. The contract is re-evaluated live if the media query flips.

export type SketchAnimation = {
  // Wall-clock length of one pass, in milliseconds. Larger is slower.
  duration: number;
  // Paint one frame at normalised time t in [0, 1]. Called by the harness on every
  // animation frame, on a step, on a reset, and on a slider drag. The sketch reads
  // theme colors itself (live, via getComputedStyle) so it stays theme-reactive.
  render: (t: number) => void;
  // Loop back to t = 0 at the end instead of stopping at t = 1. Default false.
  loop?: boolean;
  // Optional labelled slider. When present the control bar shows it and a drag
  // scrubs render(t) directly. Label is a short mono caption (e.g. "level").
  slider?: { label: string };
};

type SketchProps = {
  // Mono label above the frame: UPPERCASE, the house metadata style.
  label: string;
  // The render area and any sketch-specific content (a caption, a readout). The
  // sketch's own <canvas>/<svg> must carry its own aria-label; the harness frames
  // it but does not own its accessible name.
  children: ReactNode;
  // Present => animated. Absent => static.
  animation?: SketchAnimation;
  className?: string;
};

function usePrefersReducedMotion(): boolean {
  // Default to "reduced" so the very first paint never moves, even before the
  // effect runs. The effect corrects it and subscribes to live changes.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export default function Sketch({
  label,
  children,
  animation,
  className,
}: SketchProps) {
  return (
    <figure className={`mt-12 mb-10${className ? ` ${className}` : ""}`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-2">
        {label}
      </div>
      <div className="border border-ink">
        <div className="relative">{children}</div>
        {animation && <Controls animation={animation} />}
      </div>
    </figure>
  );
}

// The animated control bar plus the RAF clock. Split out so the static path
// carries no animation machinery at all.
function Controls({ animation }: { animation: SketchAnimation }) {
  const { duration, render, loop = false, slider } = animation;
  const reduced = usePrefersReducedMotion();

  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(1); // SSR-safe default; the resting-frame effect adjusts it
  const touched = useRef(false); // the viewer has taken control (play/step/reset/scrub)
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0); // wall-clock anchor for the current run
  const tAtStartRef = useRef<number>(1);

  // Keep a stable reference to render so the loop effect does not restart when a
  // parent re-creates the closure each render.
  const renderRef = useRef(render);
  renderRef.current = render;

  // Resting frame. Motion viewers start at the beginning (t = 0) so a single "play" runs
  // forward and the slider sits at the left; reduced-motion viewers keep the representative
  // end state (t = 1), since play is disabled for them and a blank start would show nothing.
  // Set once the motion preference is known, and only until the viewer takes control.
  useEffect(() => {
    if (touched.current) return;
    setT(reduced ? 1 : 0);
  }, [reduced]);

  // Paint the resting frame on mount and whenever t changes while paused. Nothing ever
  // autoplays: the first frame is stationary, the start for motion viewers and the end
  // for reduced-motion viewers.
  useEffect(() => {
    if (!playing) renderRef.current(t);
  }, [playing, t]);

  // The clock. Only runs while playing. Translates wall-clock to normalised t,
  // loops or halts at the end, and paints each frame through the live render ref.
  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now();
    tAtStartRef.current = t >= 1 && !loop ? 0 : t; // replay from 0 if at the end
    const tick = (now: number) => {
      const elapsed = (now - startRef.current) / duration;
      let next = tAtStartRef.current + elapsed;
      if (next >= 1) {
        if (loop) {
          next = next % 1;
        } else {
          next = 1;
          renderRef.current(1);
          setT(1);
          setPlaying(false);
          return;
        }
      }
      renderRef.current(next);
      setT(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // t is intentionally read once at play time (the resume point), not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration, loop]);

  const onStep = useCallback(() => {
    touched.current = true;
    setPlaying(false);
    setT((cur) => Math.min(1, cur + 0.05));
  }, []);

  const onReset = useCallback(() => {
    touched.current = true;
    setPlaying(false);
    setT(0);
  }, []);

  const onScrub = useCallback((value: number) => {
    touched.current = true;
    setPlaying(false);
    setT(value);
  }, []);

  const onPlay = useCallback(() => {
    touched.current = true;
    setPlaying((p) => !p);
  }, []);

  const btn =
    "font-mono text-[11px] lowercase tracking-[0.06em] border border-ink px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink px-3 py-2.5">
      <button
        type="button"
        className={btn}
        onClick={onPlay}
        disabled={reduced && !playing}
        aria-pressed={playing}
        title={reduced ? "motion reduced — scrub or step instead" : undefined}
      >
        {playing ? "pause" : "play"}
      </button>
      <button type="button" className={btn} onClick={onStep} disabled={t >= 1}>
        step
      </button>
      <button type="button" className={btn} onClick={onReset} disabled={t <= 0}>
        reset
      </button>
      {slider && (
        <label className="flex items-center gap-2 ml-1 font-mono text-[11px] uppercase tracking-[0.12em] opacity-55">
          {slider.label}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={t}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="accent-ink"
            aria-label={slider.label}
          />
        </label>
      )}
    </div>
  );
}
