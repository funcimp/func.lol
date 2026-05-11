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

    // Pan: pointer drag updates offset.
    let panning = false;
    let lastX = 0, lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      panning = true;
      canvas.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (panning) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        offsetRef.current[0] -= dx / zoomRef.current;
        offsetRef.current[1] -= dy / zoomRef.current;
        maybeReAnchor();
        requestRender();
      }
      // Hover readout: point-in-polygon against the visible tiles
      // (small list, the test is O(k) where k is tile count).
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - sizeRef.current.w / 2;
      const cy = e.clientY - rect.top - sizeRef.current.h / 2;
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
    const onPointerUp = (e: PointerEvent) => {
      panning = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
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
      const ink = readCssVar("--color-ink") || "#161616";
      const paper = readCssVar("--color-paper") || "#f5f3ec";
      const thickFill = readCssVar("--color-moment-1") || ink;
      const thinFill = readCssVar("--color-moment-3") || ink;
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
        thickFill,
        thinFill,
        stroke: ink,
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

type Palette = { thickFill: string; thinFill: string; stroke: string };

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
  const project = (v: readonly [number, number]) => [
    (v[0] - offset[0]) * zoom + cx,
    (v[1] - offset[1]) * zoom + cy,
  ];

  // Bin by type so each fill pass is a single solid color.
  const thick: Tile[] = [];
  const thin: Tile[] = [];
  for (const t of tiles) (t.type === "thick" ? thick : thin).push(t);

  const buildPath = (set: Tile[]) => {
    for (const tile of set) {
      const [v0, v1, v2, v3] = tile.vertices;
      const p0 = project(v0), p1 = project(v1), p2 = project(v2), p3 = project(v3);
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.closePath();
    }
  };

  // Fill thick rhombi (warm gold, low alpha).
  ctx.beginPath();
  buildPath(thick);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = palette.thickFill;
  ctx.fill();

  // Fill thin rhombi (muted purple, low alpha).
  ctx.beginPath();
  buildPath(thin);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = palette.thinFill;
  ctx.fill();

  // Stroke everything in one pass — line work over the muted fills.
  ctx.beginPath();
  buildPath(thick);
  buildPath(thin);
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.stroke;
  ctx.stroke();

  ctx.globalAlpha = 1;
}
