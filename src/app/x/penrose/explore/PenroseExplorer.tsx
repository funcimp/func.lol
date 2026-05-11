"use client";

import { useEffect, useRef, useState } from "react";

import {
  enumerateTiles,
  gammaFromSeed,
  makeAnchor,
  tileContains,
  type Anchor,
  type Coord,
  type Tile,
} from "./lib/pentagrid";

const RE_ANCHOR_THRESHOLD = 1e8;

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readCssVar(name: string): string {
  if (typeof document === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function PenroseExplorer({ seed = "funclol" }: { seed?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan / zoom state in refs (no re-renders on each frame).
  const gammaRef = useRef(gammaFromSeed(seed));
  const anchorRef = useRef<Anchor>(makeAnchor(0n, 0n, gammaRef.current.exact));
  const offsetRef = useRef<[number, number]>([0, 0]);
  const zoomRef = useRef<number>(40);
  const dprRef = useRef<number>(1);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dirtyRef = useRef<boolean>(true);
  const rafRef = useRef<number | null>(null);
  const tilesRef = useRef<Tile[]>([]);

  // Hover readout state. Updates on pointermove via the readout ref to
  // avoid React re-render on every cursor pixel.
  const [hoverCoord, setHoverCoord] = useState<Coord | null>(null);
  const [tileCount, setTileCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const requestRender = () => {
      dirtyRef.current = true;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      requestRender();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Theme changes trigger a re-render (canvas reads --color-* fresh).
    const themeObserver = new MutationObserver(requestRender);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Pan + pinch via pointer events. One Map of active pointers handles
    // mouse, pen, and 1-or-more touches uniformly. Pinch fires when 2+
    // pointers are active (touch only — mouse/pen never have 2).
    const pointers = new Map<number, [number, number]>();
    let gesture: { midX: number; midY: number; dist: number } | null = null;

    const updateHover = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left - sizeRef.current.w / 2;
      const cy = clientY - rect.top - sizeRef.current.h / 2;
      const worldX = cx / zoomRef.current + offsetRef.current[0];
      const worldY = cy / zoomRef.current + offsetRef.current[1];
      let found: Tile | null = null;
      for (const tile of tilesRef.current) {
        if (tileContains(tile, worldX, worldY)) {
          found = tile;
          break;
        }
      }
      setHoverCoord(found ? found.coord : null);
    };

    const refreshGesture = () => {
      if (pointers.size < 2) {
        gesture = null;
        return;
      }
      const pts = [...pointers.values()];
      const midX = (pts[0][0] + pts[1][0]) / 2;
      const midY = (pts[0][1] + pts[1][1]) / 2;
      const dist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      gesture = { midX, midY, dist };
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      refreshGesture();
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (prev) {
        const dx = e.clientX - prev[0];
        const dy = e.clientY - prev[1];
        pointers.set(e.pointerId, [e.clientX, e.clientY]);

        if (pointers.size === 1) {
          // Single-pointer pan.
          offsetRef.current[0] -= dx / zoomRef.current;
          offsetRef.current[1] -= dy / zoomRef.current;
          maybeReAnchor();
          requestRender();
        } else if (pointers.size >= 2 && gesture !== null) {
          // Pinch zoom + two-finger pan.
          const pts = [...pointers.values()];
          const midX = (pts[0][0] + pts[1][0]) / 2;
          const midY = (pts[0][1] + pts[1][1]) / 2;
          const dist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
          if (dist > 0 && gesture.dist > 0) {
            const rect = canvas.getBoundingClientRect();
            const px = midX - rect.left - sizeRef.current.w / 2;
            const py = midY - rect.top - sizeRef.current.h / 2;
            const worldX = px / zoomRef.current + offsetRef.current[0];
            const worldY = py / zoomRef.current + offsetRef.current[1];
            const newZoom = clamp(zoomRef.current * (dist / gesture.dist), 4, 800);
            zoomRef.current = newZoom;
            // Anchor zoom on the midpoint.
            offsetRef.current[0] = worldX - px / newZoom;
            offsetRef.current[1] = worldY - py / newZoom;
            // Pan from midpoint shift (two-finger drag).
            offsetRef.current[0] -= (midX - gesture.midX) / newZoom;
            offsetRef.current[1] -= (midY - gesture.midY) / newZoom;
            maybeReAnchor();
            requestRender();
          }
          gesture = { midX, midY, dist };
        }
      }
      // Hover readout. For touch, only meaningful at pointermove with
      // capture (one finger), but harmless to update always.
      updateHover(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      refreshGesture();
    };

    // Zoom: wheel pivots on cursor.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - sizeRef.current.w / 2;
      const cy = e.clientY - rect.top - sizeRef.current.h / 2;
      const worldX = cx / zoomRef.current + offsetRef.current[0];
      const worldY = cy / zoomRef.current + offsetRef.current[1];
      const newZoom = clamp(zoomRef.current * Math.exp(-e.deltaY * 0.001), 4, 800);
      zoomRef.current = newZoom;
      offsetRef.current[0] = worldX - cx / newZoom;
      offsetRef.current[1] = worldY - cy / newZoom;
      maybeReAnchor();
      requestRender();
    };

    const maybeReAnchor = () => {
      const [ox, oy] = offsetRef.current;
      if (Math.abs(ox) > RE_ANCHOR_THRESHOLD || Math.abs(oy) > RE_ANCHOR_THRESHOLD) {
        // Snap the anchor by the integer-rounded offset; preserve the
        // fractional part as the new offset so the view doesn't jump.
        const stepX = BigInt(Math.trunc(ox));
        const stepY = BigInt(Math.trunc(oy));
        const SCALE_BIG = 10n ** 50n;
        const newX = anchorRef.current.x + stepX * SCALE_BIG;
        const newY = anchorRef.current.y + stepY * SCALE_BIG;
        anchorRef.current = makeAnchor(newX, newY, gammaRef.current.exact);
        offsetRef.current[0] = ox - Number(stepX);
        offsetRef.current[1] = oy - Number(stepY);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    function render() {
      rafRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const { w, h } = sizeRef.current;
      const dpr = dprRef.current;
      const outlineThick = readCssVar("--color-moment-4") || "#161616";
      const outlineThin = readCssVar("--color-moment-1") || "#161616";
      const paper = readCssVar("--color-paper") || "#f5f3ec";
      const decoration = readCssVar("--color-moment-3") || outlineThick;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = paper;
      ctx!.fillRect(0, 0, w, h);

      // Viewport rect in offset coords.
      const halfW = w / 2 / zoomRef.current;
      const halfH = h / 2 / zoomRef.current;
      const margin = 2;
      const rect = {
        x0: offsetRef.current[0] - halfW - margin,
        y0: offsetRef.current[1] - halfH - margin,
        x1: offsetRef.current[0] + halfW + margin,
        y1: offsetRef.current[1] + halfH + margin,
      };
      const tiles = enumerateTiles(anchorRef.current, rect);
      tilesRef.current = tiles;
      drawTiles(ctx!, tiles, w, h, offsetRef.current, zoomRef.current, {
        outlineThick,
        outlineThin,
        decoration,
      });
      setTileCount(tiles.length);
    }

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none cursor-grab active:cursor-grabbing"
        aria-label="Penrose tiling explorer canvas"
      />
      <div
        aria-live="polite"
        className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.12em] opacity-55 select-none pointer-events-none"
      >
        <div>seed&nbsp;&nbsp;{seed}</div>
        <div>tiles&nbsp;{tileCount}</div>
        {hoverCoord && (
          <div className="mt-1">
            coord&nbsp;[{hoverCoord.map((c) => c.toString()).join(",")}]
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

type Palette = { outlineThick: string; outlineThin: string; decoration: string };

function drawTiles(
  ctx: CanvasRenderingContext2D,
  tiles: readonly Tile[],
  w: number,
  h: number,
  offset: readonly [number, number],
  zoom: number,
  palette: Palette,
) {
  const cx = w / 2;
  const cy = h / 2;
  const project = (v: readonly [number, number]): [number, number] => [
    (v[0] - offset[0]) * zoom + cx,
    (v[1] - offset[1]) * zoom + cy,
  ];

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 1. Outlines, per-tile, clipped to the rhombus interior. The clip
  //    means the stroke band sits inside the shape rather than centered
  //    on the edge, so adjacent rhombi of different types meet cleanly
  //    at shared edges (no muddy color mixing on the boundary).
  //    Stroke width is doubled because the outer half is clipped away.
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4; // half clipped → visible width ≈ 2px
  for (const tile of tiles) {
    const [v0, v1, v2, v3] = tile.vertices;
    const p0 = project(v0), p1 = project(v1), p2 = project(v2), p3 = project(v3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.clip();
    // Rebuild the path for stroking (clip is allowed to consume it).
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.strokeStyle = tile.type === "thick" ? palette.outlineThick : palette.outlineThin;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Long-diagonal decoration — connects acute vertices of each rhombus.
  //    Thin line, ~1/3 the outline weight, lets the borders dominate.
  ctx.beginPath();
  for (const tile of tiles) {
    const [v0, v1, v2, v3] = tile.vertices;
    const a = tile.type === "thick" ? project(v0) : project(v1);
    const b = tile.type === "thick" ? project(v2) : project(v3);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = palette.decoration;
  ctx.stroke();

  ctx.globalAlpha = 1;
}
