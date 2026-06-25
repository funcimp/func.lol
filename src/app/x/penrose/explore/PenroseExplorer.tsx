"use client";

import { useEffect, useRef, useState } from "react";

import { ChunkCache } from "./lib/chunks";
import { GAMMA, tileCentroid } from "./lib/pentagrid";
import { buildHitIndex, hitFace, type HitIndex } from "./lib/hitTest";
import { encodeTile, decodeTile, parseSeed, parseZoom, type TileAddress } from "./lib/codec";

const DEFAULT_ZOOM = 40; // px per unit edge

function readCssVar(name: string): string {
  if (typeof document === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Deterministic seed to camera center: a pure hash to a world position. The plane
// is edgeless and homogeneous away from the origin, so any point is a valid
// generic location; the cache generates whatever the viewport lands on. Spreads
// seeds across a wide annulus off the singular sun center at the origin.
function seedToCenter(seed: string): readonly [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = 30 + ((h >>> 0) % 400);
  const a = ((h >>> 8) % 360) * (Math.PI / 180);
  return [r * Math.cos(a), r * Math.sin(a)];
}

export default function PenroseExplorer({ seed = "funclol" }: { seed?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cacheRef = useRef<ChunkCache | null>(null);
  const hitRef = useRef<HitIndex | null>(null);
  const offsetRef = useRef<[number, number]>([0, 0]);
  const zoomRef = useRef<number>(DEFAULT_ZOOM);
  const dprRef = useRef<number>(1);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dirtyRef = useRef<boolean>(true);
  const rafRef = useRef<number | null>(null);
  const pinnedRef = useRef<TileAddress | null>(null);

  const [hoverAddress, setHoverAddress] = useState<TileAddress | null>(null);
  const [pinnedAddress, setPinnedAddress] = useState<TileAddress | null>(null);
  const [ready, setReady] = useState(false);

  // The plane is generated per viewport, so there is no whole-plane build to wait
  // on. Create the chunk cache, then read the share URL once: a pinned address and
  // zoom override the seed-derived center, so a shared link reopens on the exact
  // tile. The pin centers on the tile's physical centroid; the render loop then
  // generates that tile in view and the hit index resolves it on the first frame.
  useEffect(() => {
    cacheRef.current = new ChunkCache(GAMMA);

    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const tAddr = decodeTile(params.get("t") ?? undefined);
    const z = parseZoom(params.get("z") ?? undefined);
    if (z !== null) zoomRef.current = z;

    if (tAddr) {
      const addr: TileAddress = { coord: tAddr.coord, j: tAddr.j, k: tAddr.k };
      pinnedRef.current = addr;
      setPinnedAddress(addr);
      const c = tileCentroid(tAddr.coord, tAddr.j, tAddr.k);
      offsetRef.current = [c[0], c[1]];
    } else {
      const c = seedToCenter(seed);
      offsetRef.current = [c[0], c[1]];
    }
    // No multi-second build; the cache fills lazily as the viewport asks for cells.
    setReady(true);
  }, [seed]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const requestRender = () => {
      dirtyRef.current = true;
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(render);
    };

    // Debounced share-URL writer. Reads the live camera refs and the seed prop,
    // then replaces the query string in place. No history entry, no navigation.
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
    const writeUrl = () => {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        const params = new URLSearchParams();
        const s = parseSeed(seed);
        if (s) params.set("s", s);
        if (pinnedRef.current) params.set("t", encodeTile(pinnedRef.current));
        params.set("z", String(Math.round(zoomRef.current)));
        window.history.replaceState(null, "", `?${params.toString()}`);
      }, 250);
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

    const themeObserver = new MutationObserver(requestRender);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const pointers = new Map<number, [number, number]>();
    let gesture: { midX: number; midY: number; dist: number } | null = null;

    const updateHover = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left - sizeRef.current.w / 2;
      const cy = clientY - rect.top - sizeRef.current.h / 2;
      const wx = cx / zoomRef.current + offsetRef.current[0];
      const wy = cy / zoomRef.current + offsetRef.current[1];
      const f = hitRef.current ? hitFace(hitRef.current, wx, wy) : null;
      setHoverAddress(f ? { coord: f.coord, j: f.j, k: f.k } : null);
    };

    const refreshGesture = () => {
      if (pointers.size < 2) { gesture = null; return; }
      const pts = [...pointers.values()];
      const midX = (pts[0][0] + pts[1][0]) / 2, midY = (pts[0][1] + pts[1][1]) / 2;
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
        const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (pointers.size === 1) {
          offsetRef.current[0] -= dx / zoomRef.current;
          offsetRef.current[1] -= dy / zoomRef.current;
          requestRender();
          writeUrl();
        } else if (pointers.size >= 2 && gesture !== null) {
          const pts = [...pointers.values()];
          const midX = (pts[0][0] + pts[1][0]) / 2, midY = (pts[0][1] + pts[1][1]) / 2;
          const dist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
          if (dist > 0 && gesture.dist > 0) {
            const rect = canvas.getBoundingClientRect();
            const px = midX - rect.left - sizeRef.current.w / 2;
            const py = midY - rect.top - sizeRef.current.h / 2;
            const worldX = px / zoomRef.current + offsetRef.current[0];
            const worldY = py / zoomRef.current + offsetRef.current[1];
            const newZoom = clamp(zoomRef.current * (dist / gesture.dist), 4, 800);
            zoomRef.current = newZoom;
            offsetRef.current[0] = worldX - px / newZoom;
            offsetRef.current[1] = worldY - py / newZoom;
            offsetRef.current[0] -= (midX - gesture.midX) / newZoom;
            offsetRef.current[1] -= (midY - gesture.midY) / newZoom;
            requestRender();
            writeUrl();
          }
          gesture = { midX, midY, dist };
        }
      }
      updateHover(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      refreshGesture();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - sizeRef.current.w / 2;
      const cy = e.clientY - rect.top - sizeRef.current.h / 2;
      const worldX = cx / zoomRef.current + offsetRef.current[0];
      const worldY = cy / zoomRef.current + offsetRef.current[1];
      // Zoom speed. macOS trackpad pinch arrives as a wheel event with ctrlKey and
      // small, frequent deltas, so it needs a higher factor than a discrete mouse
      // wheel notch to feel responsive. Tune these two if it is too fast or too slow.
      const factor = e.ctrlKey ? 0.01 : 0.0025;
      const newZoom = clamp(zoomRef.current * Math.exp(-e.deltaY * factor), 4, 800);
      zoomRef.current = newZoom;
      offsetRef.current[0] = worldX - cx / newZoom;
      offsetRef.current[1] = worldY - cy / newZoom;
      requestRender();
      writeUrl();
    };

    // Click to pin. The pinned tile becomes the camera origin and the share
    // address. A pin fires only for a genuine single-pointer tap: a small
    // movement threshold separates a click from a pan, and a press that ever
    // saw a second pointer (a pinch) never pins, so a pinch release cannot
    // mutate the share URL. onPointerUp (the pan handler) deletes the lifted
    // pointer before this runs, so pointers.size === 0 means the last pointer.
    let downAt: { x: number; y: number } | null = null;
    let wasMultiTouch = false;
    const onClickDown = (e: PointerEvent) => {
      if (pointers.size > 1) wasMultiTouch = true;
      if (!downAt) downAt = { x: e.clientX, y: e.clientY };
    };
    const onClickUp = (e: PointerEvent) => {
      const lastPointer = pointers.size === 0;
      const start = downAt;
      const multi = wasMultiTouch;
      if (lastPointer) { downAt = null; wasMultiTouch = false; }
      if (!start || !lastPointer || multi) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved > 6) return; // a drag, not a click
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - sizeRef.current.w / 2;
      const cy = e.clientY - rect.top - sizeRef.current.h / 2;
      const wx = cx / zoomRef.current + offsetRef.current[0];
      const wy = cy / zoomRef.current + offsetRef.current[1];
      const f = hitRef.current ? hitFace(hitRef.current, wx, wy) : null;
      if (!f) return;
      const addr: TileAddress = { coord: f.coord, j: f.j, k: f.k };
      pinnedRef.current = addr;
      setPinnedAddress(addr);
      offsetRef.current = [f.centroid[0], f.centroid[1]];
      requestRender();
      writeUrl();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onClickDown);
    canvas.addEventListener("pointerup", onClickUp);
    canvas.addEventListener("pointercancel", onClickUp);

    function render() {
      rafRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const cache = cacheRef.current;
      if (!cache) return;
      const { w, h } = sizeRef.current;
      const dpr = dprRef.current;
      const thick = readCssVar("--color-moment-1") || "#C89B3C";
      const thin = readCssVar("--color-moment-4") || "#3E6B7C";
      const grout = readCssVar("--color-paper") || "#0f0e0c";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = grout;
      ctx!.fillRect(0, 0, w, h);

      const zoom = zoomRef.current;
      const [ox, oy] = offsetRef.current;
      const cx = w / 2, cy = h / 2;
      const halfW = w / 2 / zoom + 2, halfH = h / 2 / zoom + 2;
      const x0 = ox - halfW, x1 = ox + halfW, y0 = oy - halfH, y1 = oy + halfH;

      // Generate exactly the tiles the viewport touches, then rebuild the hit
      // index over that same visible set so hover and click-to-pin test against
      // what is drawn. The cache returns only in-view faces, so there is no
      // centroid cull here. A viewport holds a few hundred to low-thousands of
      // faces, so rebuilding the index each frame is cheap.
      const faces = cache.facesInView({ minX: x0, minY: y0, maxX: x1, maxY: y1 });
      hitRef.current = buildHitIndex(faces);

      ctx!.lineJoin = "round";
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = grout;
      for (const f of faces) {
        const [a, b, c, d] = f.corners;
        ctx!.beginPath();
        ctx!.moveTo((a[0] - ox) * zoom + cx, (a[1] - oy) * zoom + cy);
        ctx!.lineTo((b[0] - ox) * zoom + cx, (b[1] - oy) * zoom + cy);
        ctx!.lineTo((c[0] - ox) * zoom + cx, (c[1] - oy) * zoom + cy);
        ctx!.lineTo((d[0] - ox) * zoom + cx, (d[1] - oy) * zoom + cy);
        ctx!.closePath();
        ctx!.fillStyle = f.type === "thick" ? thick : thin;
        ctx!.fill();
        ctx!.stroke();
      }
    }

    requestRender();

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onClickDown);
      canvas.removeEventListener("pointerup", onClickUp);
      canvas.removeEventListener("pointercancel", onClickUp);
      if (writeTimer) clearTimeout(writeTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- writeUrl reads `seed`, but seed is a stable prop in v1 (a seed change recreates the cache in the other effect, which flips `ready` and rewires this one). Keep the deps as [ready].
  }, [ready]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none cursor-grab active:cursor-grabbing"
        aria-label="Penrose tiling explorer canvas"
        tabIndex={0}
      />
      <div
        aria-live="polite"
        className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.12em] opacity-55 select-none pointer-events-none"
      >
        <div>seed&nbsp;&nbsp;{seed}</div>
        {hoverAddress && (
          <div className="mt-1">
            address&nbsp;[{hoverAddress.coord.join(",")}] j{hoverAddress.j} k{hoverAddress.k}
          </div>
        )}
        {pinnedAddress && (
          <div className="mt-1">
            pinned&nbsp;[{pinnedAddress.coord.join(",")}] j{pinnedAddress.j} k{pinnedAddress.k}
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}
