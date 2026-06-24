# Penrose v1 Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, shareable bounded Penrose explorer at `/x/penrose/explore`, built on the tested cut-and-project / substitution engine, where every tile under the cursor shows its exact ℤ⁵ address and any view is a shareable URL.

**Architecture:** Port the tested engine (`research/penrose/cap/`) into the app. Add three thin pure modules on top: a patch builder (engine faces → render model with corner positions, one frame), hit-testing (point → tile), and an address codec (ℤ⁵ tile + camera ↔ URL). Rewrite the explorer component to build one large patch at mount and pan/zoom over it as camera math, salvaging the existing canvas/interaction layer. Client-side only, no server runtime.

**Tech Stack:** Next.js App Router, React, TypeScript, native 2D canvas, Bun (`bun test`), Playwright (`bunx playwright test`). No new dependencies.

**Scope:** This plan is the explorer (spec slices 1–4). The teaching spine (palette tokens, landing writeup, Sketch harness, sketches) is a separate follow-up plan. The B1 Mosaic palette is deferred; this plan renders with the existing `--color-moment-*` tokens as an interim, swapped out in the palette slice.

**Spec:** `docs/superpowers/specs/2026-06-24-penrose-v1-design.md`.

## Global Constraints

- **Tooling:** `bun` and `bunx` only. Never `npm`/`npx`/`yarn`/`pnpm`.
- **Client-only:** No server data flow, no `useSearchParams`, no Suspense for the explorer, no `export const runtime/revalidate/dynamic`. URL state is read once from `window.location.search` and written with debounced `history.replaceState`.
- **No architectural drift:** No caching primitives, no module-level singletons, no `'use cache'`. The patch is a per-mount client object.
- **Frame discipline:** Render and hit-test exclusively in the `LiftedVertex.pos` frame. Never reconstruct corner positions with `physical(coord)`; look them up by coord key in the lifted vertex set. `pos` and `physical(coord)` differ by a fixed rotation.
- **Tests:** Colocated `*.test.ts` with `bun:test`, table-driven where the shape fits. Engine tests must stay green after the port (`bun test ./src/app/x/penrose/` → 34 pass). E2E lives in `e2e/x/penrose/`.
- **Prose:** No emdashes in any user-facing copy. Use periods and commas.
- **Routing:** `/x/penrose/explore` is confirmed safe against `src/lib/tripwire/patterns.ts` (the `/x/` prefix short-circuits the matcher). Do not add a route matching a tripwire pattern.
- **Engine is classical and tested:** Do not modify the ported engine's math. It reproduces de Bruijn / D'Andrea results; see `research/penrose/STATUS.md`.

---

## File Structure

- **Move (git mv), no edits needed (relative imports preserved):**
  - `research/penrose/cap/cap.ts` → `src/app/x/penrose/explore/lib/cap.ts`
  - `research/penrose/cap/deflate.ts` → `src/app/x/penrose/explore/lib/deflate.ts`
  - `research/penrose/cap/bridge.ts` → `src/app/x/penrose/explore/lib/bridge.ts`
  - `research/penrose/cap/fold.ts` → `src/app/x/penrose/explore/lib/fold.ts`
  - `research/penrose/cap/faces.ts` → `src/app/x/penrose/explore/lib/faces.ts`
  - the matching `*.test.ts` for each
- **Create:**
  - `src/app/x/penrose/explore/lib/patch.ts` — engine faces → render model (corners, centroid, bounds), one frame.
  - `src/app/x/penrose/explore/lib/patch.test.ts`
  - `src/app/x/penrose/explore/lib/hitTest.ts` — spatial grid + point-in-rhombus.
  - `src/app/x/penrose/explore/lib/hitTest.test.ts`
  - `src/app/x/penrose/explore/lib/codec.ts` — address/seed/zoom URL codec.
  - `src/app/x/penrose/explore/lib/codec.test.ts`
  - `e2e/x/penrose/explore.spec.ts` — canvas-mount smoke + share round-trip.
- **Modify:**
  - `src/app/x/penrose/explore/PenroseExplorer.tsx` — rewrite onto the new modules.
  - `src/app/x/penrose/explore/page.tsx` — `h-screen` → `h-dvh`.
- **Delete:**
  - `src/app/x/penrose/explore/lib/pentagrid.ts` — the old buggy engine (after the explorer stops importing it, in Task 4).

Each file has one responsibility: `patch` builds geometry, `hitTest` answers point queries, `codec` is pure URL serialization, the component is camera + interaction + paint.

---

## Task 1: Port the tested engine into the app

**Files:**
- Move: `research/penrose/cap/{cap,deflate,bridge,fold,faces}.ts` and their `.test.ts` → `src/app/x/penrose/explore/lib/`

**Interfaces:**
- Produces: the engine API in its new home. `substitutionFaces(level): { faces: Face[]; verts: LiftedVertex[] }`, `Face = { key: string; type: "thick" | "thin" }`, `LiftedVertex = { pos: readonly [number, number]; coord: readonly number[] }`, plus `lift`, `deflate`, `extractFaces`, `thickThinRatio`, `physical`, `internal`, `index`, `A`, `nextCoordCanonical`, `PHI`, `TAU`. All unchanged.

- [ ] **Step 1: Move the engine files with git, preserving the tests**

```bash
cd /Users/n2p5/src/github.com/funcimp/func.lol
git mv research/penrose/cap/cap.ts        src/app/x/penrose/explore/lib/cap.ts
git mv research/penrose/cap/cap.test.ts   src/app/x/penrose/explore/lib/cap.test.ts
git mv research/penrose/cap/deflate.ts    src/app/x/penrose/explore/lib/deflate.ts
git mv research/penrose/cap/deflate.test.ts src/app/x/penrose/explore/lib/deflate.test.ts
git mv research/penrose/cap/bridge.ts     src/app/x/penrose/explore/lib/bridge.ts
git mv research/penrose/cap/bridge.test.ts src/app/x/penrose/explore/lib/bridge.test.ts
git mv research/penrose/cap/fold.ts       src/app/x/penrose/explore/lib/fold.ts
git mv research/penrose/cap/fold.test.ts  src/app/x/penrose/explore/lib/fold.test.ts
git mv research/penrose/cap/faces.ts      src/app/x/penrose/explore/lib/faces.ts
git mv research/penrose/cap/faces.test.ts src/app/x/penrose/explore/lib/faces.test.ts
```

The five engine modules import each other only by relative path (`./deflate`, `./bridge`, `./cap`), so moving them together needs no edits.

- [ ] **Step 2: Run the ported engine tests in their new location**

Run: `bun test ./src/app/x/penrose/explore/lib/`
Expected: `34 pass, 0 fail` (24 `test()` blocks, several table-driven).

- [ ] **Step 3: Confirm nothing else imported from the old research path**

Run: `grep -rn "research/penrose/cap" src/ ; grep -rn "research/penrose/cap" docs/ || true`
Expected: no `src/` import references the old path. (`research/penrose/STATUS.md` may reference `cap/` as the research home; that is documentation, leave it. Note in the commit that the engine now lives in the app.)

- [ ] **Step 4: Verify the old engine is still present and untouched (deleted later)**

The old `src/app/x/penrose/explore/lib/pentagrid.ts` is still imported by `PenroseExplorer.tsx`. Do NOT delete it yet; the explorer is rewritten in Task 4. The build stays green.
Run: `bunx tsc --noEmit` (or `bun run build` if that is the project's typecheck path)
Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(penrose): port tested cut-and-project engine into the explorer app"
```

---

## Task 2: Patch builder (engine faces → render model)

**Files:**
- Create: `src/app/x/penrose/explore/lib/patch.ts`
- Test: `src/app/x/penrose/explore/lib/patch.test.ts`

**Interfaces:**
- Consumes: `substitutionFaces(level)`, `LiftedVertex`, `Face` from `./faces` and `./bridge`.
- Produces:
  - `type Pt = readonly [number, number]`
  - `type RenderFace = { key: string; coord: readonly number[]; type: "thick" | "thin"; corners: readonly [Pt, Pt, Pt, Pt]; centroid: Pt }`
  - `type Patch = { level: number; faces: RenderFace[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }`
  - `function buildPatch(level: number): Patch`

The `corners` are in **cyclic polygon order** `n, n+eⱼ, n+eⱼ+eₖ, n+eₖ`, all looked up by coord key in the lifted vertex `pos` frame.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/x/penrose/explore/lib/patch.test.ts
import { describe, expect, test } from "bun:test";

import { buildPatch } from "./patch";

describe("buildPatch produces a render-ready patch in the pos frame", () => {
  const patch = buildPatch(6);

  test("returns faces with the level recorded", () => {
    expect(patch.level).toBe(6);
    expect(patch.faces.length).toBeGreaterThan(100);
  });

  test("every face has a 5-component address, a type, and four finite corners", () => {
    for (const f of patch.faces) {
      expect(f.coord.length).toBe(5);
      expect(f.type === "thick" || f.type === "thin").toBe(true);
      expect(f.corners.length).toBe(4);
      for (const [x, y] of f.corners) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
    }
  });

  test("corners form a rhombus: all four edges are ~unit length", () => {
    for (const f of patch.faces) {
      const c = f.corners;
      for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        expect(Math.abs(len - 1)).toBeLessThan(0.02);
      }
    }
  });

  test("centroid is the corner average and lies inside the bounds", () => {
    for (const f of patch.faces) {
      const mx = (f.corners[0][0] + f.corners[1][0] + f.corners[2][0] + f.corners[3][0]) / 4;
      const my = (f.corners[0][1] + f.corners[1][1] + f.corners[2][1] + f.corners[3][1]) / 4;
      expect(Math.abs(f.centroid[0] - mx)).toBeLessThan(1e-9);
      expect(Math.abs(f.centroid[1] - my)).toBeLessThan(1e-9);
      expect(f.centroid[0]).toBeGreaterThanOrEqual(patch.bounds.minX);
      expect(f.centroid[0]).toBeLessThanOrEqual(patch.bounds.maxX);
    }
  });

  test("thick:thin ratio approaches phi on a real patch", () => {
    const thick = patch.faces.filter((f) => f.type === "thick").length;
    const thin = patch.faces.filter((f) => f.type === "thin").length;
    expect(thick / thin).toBeGreaterThan(1.5);
    expect(thick / thin).toBeLessThan(1.75);
  });

  test("face keys are unique", () => {
    const keys = new Set(patch.faces.map((f) => f.key));
    expect(keys.size).toBe(patch.faces.length);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun test ./src/app/x/penrose/explore/lib/patch.test.ts`
Expected: FAIL with module-not-found / `buildPatch is not a function`.

- [ ] **Step 3: Implement `patch.ts`**

```ts
// src/app/x/penrose/explore/lib/patch.ts
// Turn the tested engine's faces into a render model: each rhombus carries its
// four corner positions (cyclic order) and centroid, all in the LiftedVertex.pos
// frame. Corner positions are looked up by coord key, never recomputed via
// physical() — pos and physical(coord) differ by a fixed rotation.

import { substitutionFaces } from "./faces";

export type Pt = readonly [number, number];

export type RenderFace = {
  key: string;                  // the engine Face.key, "n0,n1,n2,n3,n4|jk" — the ℤ⁵ address
  coord: readonly number[];     // base corner n (length 5), the address anchor
  type: "thick" | "thin";
  corners: readonly [Pt, Pt, Pt, Pt]; // cyclic: n, n+e_j, n+e_j+e_k, n+e_k
  centroid: Pt;
};

export type Patch = {
  level: number;
  faces: RenderFace[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

const bump = (n: readonly number[], l: number): number[] => {
  const c = [...n];
  c[l]++;
  return c;
};

export function buildPatch(level: number): Patch {
  const { faces, verts } = substitutionFaces(level);

  const posByCoord = new Map<string, Pt>();
  for (const v of verts) posByCoord.set(v.coord.join(","), v.pos);

  const out: RenderFace[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const f of faces) {
    const [coordStr, jk] = f.key.split("|");
    const n = coordStr.split(",").map(Number);
    const j = Number(jk[0]);
    const k = Number(jk[1]);

    // Cyclic corner coords around the rhombus.
    const cn = n;
    const cj = bump(n, j);
    const cjk = bump(cj, k);
    const ck = bump(n, k);

    const p0 = posByCoord.get(cn.join(","));
    const p1 = posByCoord.get(cj.join(","));
    const p2 = posByCoord.get(cjk.join(","));
    const p3 = posByCoord.get(ck.join(","));
    if (!p0 || !p1 || !p2 || !p3) continue; // corner-acceptance guarantees presence

    const corners: readonly [Pt, Pt, Pt, Pt] = [p0, p1, p2, p3];
    const centroid: Pt = [
      (p0[0] + p1[0] + p2[0] + p3[0]) / 4,
      (p0[1] + p1[1] + p2[1] + p3[1]) / 4,
    ];
    for (const [x, y] of corners) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    out.push({ key: f.key, coord: n, type: f.type, corners, centroid });
  }

  return { level, faces: out, bounds: { minX, minY, maxX, maxY } };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `bun test ./src/app/x/penrose/explore/lib/patch.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/x/penrose/explore/lib/patch.ts src/app/x/penrose/explore/lib/patch.test.ts
git commit -m "feat(penrose): patch builder turns engine faces into a render model"
```

---

## Task 3: Hit-testing (point → tile)

**Files:**
- Create: `src/app/x/penrose/explore/lib/hitTest.ts`
- Test: `src/app/x/penrose/explore/lib/hitTest.test.ts`

**Interfaces:**
- Consumes: `RenderFace`, `Pt` from `./patch`.
- Produces:
  - `type HitIndex = { cell: number; grid: Map<string, RenderFace[]> }`
  - `function buildHitIndex(faces: readonly RenderFace[], cell?: number): HitIndex`
  - `function hitFace(index: HitIndex, x: number, y: number): RenderFace | null`

A uniform grid buckets each face into every cell its corner bounding box overlaps. `hitFace` tests only the faces in the query point's cell, with a convex point-in-quad test. Faces do not overlap, so the first hit wins.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/x/penrose/explore/lib/hitTest.test.ts
import { describe, expect, test } from "bun:test";

import { buildPatch } from "./patch";
import { buildHitIndex, hitFace } from "./hitTest";

describe("hit-testing returns the tile under a point", () => {
  const patch = buildPatch(6);
  const index = buildHitIndex(patch.faces);

  test("a face centroid hits its own face", () => {
    // Sample across the patch to keep the test fast but representative.
    const step = Math.max(1, Math.floor(patch.faces.length / 200));
    for (let i = 0; i < patch.faces.length; i += step) {
      const f = patch.faces[i];
      const hit = hitFace(index, f.centroid[0], f.centroid[1]);
      expect(hit?.key).toBe(f.key);
    }
  });

  test("a point well outside the patch hits nothing", () => {
    const far = patch.bounds.maxX + 1000;
    expect(hitFace(index, far, far)).toBeNull();
  });

  test("a hit's corners actually contain the query point", () => {
    const f = patch.faces[Math.floor(patch.faces.length / 2)];
    const hit = hitFace(index, f.centroid[0], f.centroid[1]);
    expect(hit).not.toBeNull();
    // centroid is strictly interior to a convex rhombus
    expect(hit!.key).toBe(f.key);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun test ./src/app/x/penrose/explore/lib/hitTest.test.ts`
Expected: FAIL with `buildHitIndex is not a function`.

- [ ] **Step 3: Implement `hitTest.ts`**

```ts
// src/app/x/penrose/explore/lib/hitTest.ts
// Point → tile, accelerated by a uniform spatial grid. Tiles are ~unit sized in
// the pos frame, so a cell near 1.5 units keeps buckets small. Each face is
// bucketed into every cell its bounding box overlaps; a query tests only its
// own cell. Faces are non-overlapping, so the first containing face wins.

import type { Pt, RenderFace } from "./patch";

export type HitIndex = { cell: number; grid: Map<string, RenderFace[]> };

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

export function buildHitIndex(faces: readonly RenderFace[], cell = 1.5): HitIndex {
  const grid = new Map<string, RenderFace[]>();
  for (const f of faces) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of f.corners) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const cx0 = Math.floor(minX / cell), cx1 = Math.floor(maxX / cell);
    const cy0 = Math.floor(minY / cell), cy1 = Math.floor(maxY / cell);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = cellKey(cx, cy);
        const bucket = grid.get(key);
        if (bucket) bucket.push(f);
        else grid.set(key, [f]);
      }
    }
  }
  return { cell, grid };
}

function pointInQuad(px: number, py: number, q: readonly [Pt, Pt, Pt, Pt]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const cross = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

export function hitFace(index: HitIndex, x: number, y: number): RenderFace | null {
  const cx = Math.floor(x / index.cell), cy = Math.floor(y / index.cell);
  const bucket = index.grid.get(cellKey(cx, cy));
  if (!bucket) return null;
  for (const f of bucket) {
    if (pointInQuad(x, y, f.corners)) return f;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `bun test ./src/app/x/penrose/explore/lib/hitTest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/x/penrose/explore/lib/hitTest.ts src/app/x/penrose/explore/lib/hitTest.test.ts
git commit -m "feat(penrose): spatial-grid hit-testing maps a point to its tile"
```

---

## Task 4: Rewrite the explorer onto the new engine

**Files:**
- Modify: `src/app/x/penrose/explore/PenroseExplorer.tsx` (full rewrite, salvaging the canvas/interaction layer)
- Modify: `src/app/x/penrose/explore/page.tsx` (`h-screen` → `h-dvh`)
- Delete: `src/app/x/penrose/explore/lib/pentagrid.ts`
- Test: `e2e/x/penrose/explore.spec.ts` (canvas-mount smoke)

**Interfaces:**
- Consumes: `buildPatch`, `Patch`, `RenderFace` from `./lib/patch`; `buildHitIndex`, `hitFace`, `HitIndex` from `./lib/hitTest`.
- Produces: a working `<PenroseExplorer seed="..." />` that builds one patch at mount, pans/zooms over it, and shows the address under the cursor.

Colors are interim (`--color-moment-1` thick, `--color-moment-4` thin, `--color-paper` grout). The B1 palette is a later slice.

- [ ] **Step 1: Replace `PenroseExplorer.tsx` in full**

```tsx
// src/app/x/penrose/explore/PenroseExplorer.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { buildPatch, type Patch } from "./lib/patch";
import { buildHitIndex, hitFace, type HitIndex } from "./lib/hitTest";

const PATCH_LEVEL = 10; // ~55k faces, world radius ~123 unit edges, ~350ms one-time build
const DEFAULT_ZOOM = 40; // px per unit edge

function readCssVar(name: string): string {
  if (typeof document === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Deterministic seed → camera center: hash the seed, pick a face centroid in a
// mid-radius band so the default view is generic — off the singular sun center
// at the origin, in from the patch boundary.
function seedToCenter(seed: string, patch: Patch): readonly [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const { minX, minY, maxX, maxY } = patch.bounds;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rMax = Math.min(maxX - cx, maxY - cy);
  const band = patch.faces.filter((f) => {
    const r = Math.hypot(f.centroid[0] - cx, f.centroid[1] - cy);
    return r > rMax * 0.25 && r < rMax * 0.6;
  });
  const pool = band.length > 0 ? band : patch.faces;
  return pool[(h >>> 0) % pool.length].centroid;
}

export default function PenroseExplorer({ seed = "funclol" }: { seed?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const patchRef = useRef<Patch | null>(null);
  const hitRef = useRef<HitIndex | null>(null);
  const offsetRef = useRef<[number, number]>([0, 0]);
  const zoomRef = useRef<number>(DEFAULT_ZOOM);
  const dprRef = useRef<number>(1);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dirtyRef = useRef<boolean>(true);
  const rafRef = useRef<number | null>(null);

  const [hoverAddress, setHoverAddress] = useState<readonly number[] | null>(null);
  const [ready, setReady] = useState(false);

  // Build the patch once for this seed (synchronous; the overlay paints first).
  useEffect(() => {
    const patch = buildPatch(PATCH_LEVEL);
    patchRef.current = patch;
    hitRef.current = buildHitIndex(patch.faces);
    const c = seedToCenter(seed, patch);
    offsetRef.current = [c[0], c[1]];
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
      setHoverAddress(f ? f.coord : null);
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
      const newZoom = clamp(zoomRef.current * Math.exp(-e.deltaY * 0.001), 4, 800);
      zoomRef.current = newZoom;
      offsetRef.current[0] = worldX - cx / newZoom;
      offsetRef.current[1] = worldY - cy / newZoom;
      requestRender();
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
      const patch = patchRef.current;
      if (!patch) return;
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

      ctx!.lineJoin = "round";
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = grout;
      for (const f of patch.faces) {
        if (f.centroid[0] < x0 || f.centroid[0] > x1 || f.centroid[1] < y0 || f.centroid[1] > y1) continue;
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
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
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
        {hoverAddress && <div className="mt-1">address&nbsp;[{hoverAddress.join(",")}]</div>}
      </div>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 pointer-events-none">
          building tiling
        </div>
      )}
    </div>
  );
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}
```

- [ ] **Step 2: Delete the old engine and fix the shell**

```bash
git rm src/app/x/penrose/explore/lib/pentagrid.ts
```

In `src/app/x/penrose/explore/page.tsx`, change the explorer shell from `h-screen` to `h-dvh`:

```tsx
// before:  <main className="h-screen flex flex-col">
// after:
<main className="h-dvh flex flex-col">
```

- [ ] **Step 3: Typecheck and confirm no stale imports**

Run: `grep -rn "pentagrid" src/` then `bunx tsc --noEmit`
Expected: no `pentagrid` references remain; no type errors.

- [ ] **Step 4: Write the canvas-mount E2E smoke**

```ts
// e2e/x/penrose/explore.spec.ts
import { expect, test } from "@playwright/test";

test("explorer mounts a canvas", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();
});

test("explorer shows the seed in the HUD", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  await expect(page.getByText(/seed/i)).toBeVisible();
});
```

- [ ] **Step 5: Run the E2E smoke**

Run: `bunx playwright test e2e/x/penrose/explore.spec.ts`
Expected: PASS (canvas visible, seed shown). If the dev server is not auto-started by the Playwright config, start it per the repo's E2E setup first.

- [ ] **Step 6: Manual check (one line in the PR notes)**

Run the dev server, open `/x/penrose/explore`, confirm: tiling paints after a brief "building tiling" flash, pan/zoom/pinch work, and hovering a tile shows `address [..]` that stays stable as you pan back and forth over the same tile.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(penrose): rewrite explorer onto the tested engine, bounded patch with exact addresses"
```

---

## Task 5: Address codec (tile + camera ↔ URL)

**Files:**
- Create: `src/app/x/penrose/explore/lib/codec.ts`
- Test: `src/app/x/penrose/explore/lib/codec.test.ts`

**Interfaces:**
- Produces:
  - `function encodeAddress(coord: readonly number[]): string` — five integers joined by `.`, e.g. `"3.-1.0.2.-4"`.
  - `function decodeAddress(raw: string | string[] | undefined): number[] | null` — exactly five integers, else null.
  - `function parseSeed(raw: string | string[] | undefined): string | null` — `^[A-Za-z0-9_-]{1,32}$`, else null.
  - `function parseZoom(raw: string | string[] | undefined): number | null` — finite number clamped to `[4, 800]`, else null.

Decimal (not base62): the components are tiny signed integers, so decimal is clearer and round-trips signs without extra encoding. This is the v2 seam; when addresses widen to BigInt, widen the codec here. The strict "return null on bad input" contract mirrors `prime-moments/lib/share.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/x/penrose/explore/lib/codec.test.ts
import { describe, expect, test } from "bun:test";

import { encodeAddress, decodeAddress, parseSeed, parseZoom } from "./codec";

describe("address codec round-trips ℤ⁵ coordinates", () => {
  const cases: number[][] = [
    [0, 0, 0, 0, 0],
    [3, -1, 0, 2, -4],
    [10, 11, -12, 13, -14],
    [-1, -1, -1, -1, -1],
  ];
  for (const coord of cases) {
    test(`round-trips [${coord}]`, () => {
      expect(decodeAddress(encodeAddress(coord))).toEqual(coord);
    });
  }
});

describe("decodeAddress rejects bad input", () => {
  const bad: (string | string[] | undefined)[] = [
    undefined,
    ["3.0.0.0.0"],
    "",
    "1.2.3",        // too few
    "1.2.3.4.5.6",  // too many
    "1.2.x.4.5",    // non-integer
    "1.2.3.4.5.5",  // too many
    "1.5.0.0.0",    // non-integer (decimal)
  ];
  for (const raw of bad) {
    test(`rejects ${JSON.stringify(raw)}`, () => {
      expect(decodeAddress(raw)).toBeNull();
    });
  }
});

describe("parseSeed", () => {
  test("accepts a short alnum seed", () => {
    expect(parseSeed("funclol")).toBe("funclol");
    expect(parseSeed("a_b-9")).toBe("a_b-9");
  });
  test("rejects empty, array, too long, or illegal chars", () => {
    expect(parseSeed("")).toBeNull();
    expect(parseSeed(["x"])).toBeNull();
    expect(parseSeed("a".repeat(33))).toBeNull();
    expect(parseSeed("has space")).toBeNull();
  });
});

describe("parseZoom", () => {
  test("accepts and clamps", () => {
    expect(parseZoom("40")).toBe(40);
    expect(parseZoom("1")).toBe(4);     // clamped up
    expect(parseZoom("9999")).toBe(800); // clamped down
  });
  test("rejects non-numbers", () => {
    expect(parseZoom("abc")).toBeNull();
    expect(parseZoom(undefined)).toBeNull();
    expect(parseZoom(["40"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun test ./src/app/x/penrose/explore/lib/codec.test.ts`
Expected: FAIL with `encodeAddress is not a function`.

- [ ] **Step 3: Implement `codec.ts`**

```ts
// src/app/x/penrose/explore/lib/codec.ts
// URL serialization for the explorer's share link. The tile address is the ℤ⁵
// coordinate (five small signed integers); the camera adds seed and zoom. Every
// parser returns null on bad input — the caller treats null as "ignore this
// param, use the default," never an error. Decimal encoding keeps signs trivial
// and is the v2 seam (widen here when addresses become BigInt).

export function encodeAddress(coord: readonly number[]): string {
  return coord.join(".");
}

export function decodeAddress(raw: string | string[] | undefined): number[] | null {
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;
  const parts = raw.split(".");
  if (parts.length !== 5) return null;
  const coord = parts.map((s) => Number(s));
  if (coord.some((n) => !Number.isInteger(n) || Math.abs(n) > 100000)) return null;
  return coord;
}

export function parseSeed(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;
  return /^[A-Za-z0-9_-]{1,32}$/.test(raw) ? raw : null;
}

export function parseZoom(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  const z = Number(raw);
  if (!Number.isFinite(z)) return null;
  return Math.min(Math.max(z, 4), 800);
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `bun test ./src/app/x/penrose/explore/lib/codec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/x/penrose/explore/lib/codec.ts src/app/x/penrose/explore/lib/codec.test.ts
git commit -m "feat(penrose): URL codec for tile address, seed, and zoom"
```

---

## Task 6: Pin, origin, share (the one operation) + share E2E

**Files:**
- Modify: `src/app/x/penrose/explore/PenroseExplorer.tsx` (add pin, URL read-once, debounced write)
- Modify: `e2e/x/penrose/explore.spec.ts` (share round-trip)

**Interfaces:**
- Consumes: `encodeAddress`, `decodeAddress`, `parseSeed`, `parseZoom` from `./lib/codec`; `hitFace` from `./lib/hitTest`.
- Produces: click-to-pin that recenters the camera on the tile and writes `?s=&t=&z=`; a load that reads those back and centers on the pinned tile.

A pinned tile is found in the patch by matching `RenderFace.coord` to the decoded address. Pin = camera origin = share are the same action.

- [ ] **Step 1: Write the failing share round-trip E2E**

```ts
// add to e2e/x/penrose/explore.spec.ts
import { expect, test } from "@playwright/test";

test("a shared address URL loads and reports that tile", async ({ page }) => {
  // A concrete tile address present in the default patch. If this address is not
  // found (engine change), the test fails loudly — update it from a hover readout.
  await page.goto("/x/penrose/explore?s=funclol&t=0.0.0.0.0&z=40");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();
  // The pinned address is echoed in the HUD.
  await expect(page.getByText(/pinned/i)).toBeVisible();
});

test("the URL gains s, t, z after a click", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 200, y: 200 } });
  await expect(page).toHaveURL(/[?&]t=/);
  await expect(page).toHaveURL(/[?&]s=/);
  await expect(page).toHaveURL(/[?&]z=/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bunx playwright test e2e/x/penrose/explore.spec.ts`
Expected: FAIL (no "pinned" HUD line, URL unchanged after click).

- [ ] **Step 3: Add pin state and the click handler to the component**

In `PenroseExplorer.tsx`, add a pinned ref and a pinned-address state next to the existing refs:

```tsx
  const pinnedRef = useRef<readonly number[] | null>(null);
  const [pinnedAddress, setPinnedAddress] = useState<readonly number[] | null>(null);
```

Add a helper that centers the camera on a face and pins it (place beside `seedToCenter`, or inline in the effect):

```tsx
  const findFaceByCoord = (patch: Patch, coord: readonly number[]) =>
    patch.faces.find((f) => f.coord.length === coord.length && f.coord.every((v, i) => v === coord[i])) ?? null;
```

In the canvas effect, add a click handler that pins the tile under the pointer (distinguish click from drag by a small movement threshold). Register it with the other listeners and clean it up in the return:

```tsx
    let downAt: { x: number; y: number } | null = null;
    const onClickDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onClickUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 6) return; // a drag, not a click
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - sizeRef.current.w / 2;
      const cy = e.clientY - rect.top - sizeRef.current.h / 2;
      const wx = cx / zoomRef.current + offsetRef.current[0];
      const wy = cy / zoomRef.current + offsetRef.current[1];
      const f = hitRef.current ? hitFace(hitRef.current, wx, wy) : null;
      if (!f) return;
      pinnedRef.current = f.coord;
      setPinnedAddress(f.coord);
      offsetRef.current = [f.centroid[0], f.centroid[1]];
      requestRender();
      writeUrl();
    };
    canvas.addEventListener("pointerdown", onClickDown);
    canvas.addEventListener("pointerup", onClickUp);
```

Add the cleanup lines in the effect's return:

```tsx
      canvas.removeEventListener("pointerdown", onClickDown);
      canvas.removeEventListener("pointerup", onClickUp);
```

Add the pinned line to the HUD JSX, under the hover line:

```tsx
        {pinnedAddress && <div className="mt-1">pinned&nbsp;[{pinnedAddress.join(",")}]</div>}
```

- [ ] **Step 4: Add URL read-once-on-mount and debounced write**

Import the codec at the top:

```tsx
import { encodeAddress, decodeAddress, parseSeed, parseZoom } from "./lib/codec";
```

In the patch-build effect, after building the patch, read the URL once and apply a pinned tile / zoom if present (overriding the seed-derived center):

```tsx
  useEffect(() => {
    const patch = buildPatch(PATCH_LEVEL);
    patchRef.current = patch;
    hitRef.current = buildHitIndex(patch.faces);

    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const tAddr = decodeAddress(params.get("t") ?? undefined);
    const z = parseZoom(params.get("z") ?? undefined);
    if (z !== null) zoomRef.current = z;

    const pinned = tAddr ? findFaceByCoord(patch, tAddr) : null;
    if (pinned) {
      pinnedRef.current = pinned.coord;
      setPinnedAddress(pinned.coord);
      offsetRef.current = [pinned.centroid[0], pinned.centroid[1]];
    } else {
      const c = seedToCenter(seed, patch);
      offsetRef.current = [c[0], c[1]];
    }
    setReady(true);
  }, [seed]);
```

Add a debounced `writeUrl` inside the canvas effect (it reads the live refs and the current `seed` prop):

```tsx
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
    const writeUrl = () => {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        const params = new URLSearchParams();
        const s = parseSeed(seed);
        if (s) params.set("s", s);
        if (pinnedRef.current) params.set("t", encodeAddress(pinnedRef.current));
        params.set("z", String(Math.round(zoomRef.current)));
        window.history.replaceState(null, "", `?${params.toString()}`);
      }, 250);
    };
```

Call `writeUrl()` from the pan, wheel, and pinch handlers (after `requestRender()`), and clear the timer in the cleanup:

```tsx
      if (writeTimer) clearTimeout(writeTimer);
```

Note: `writeUrl` and `findFaceByCoord` reference `seed`, so the canvas effect's dependency array stays `[ready]` (the patch is rebuilt on `seed` change in the other effect, which flips `ready`). If `seed` can change without unmount in practice, add `seed` to the canvas-effect deps; for v1 the seed is a stable prop.

- [ ] **Step 5: Update the share E2E with a real address, then run it**

Run the dev server, hover a tile near the center, read its `address [..]` from the HUD, and put that exact value in the `t=` of the first E2E test (replacing `0.0.0.0.0` if that address is not in the patch).

Run: `bunx playwright test e2e/x/penrose/explore.spec.ts`
Expected: PASS (pinned HUD shows on the shared URL; URL gains `s`, `t`, `z` after a click).

- [ ] **Step 6: Full test sweep**

Run: `bun test ./src/app/x/penrose/ && bunx playwright test e2e/x/penrose/`
Expected: engine + unit tests `34 + patch + hitTest + codec` all pass; both E2E specs pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(penrose): click-to-pin doubles as camera origin and share URL"
```

---

## Self-Review notes (for the executor)

- **Frame discipline.** If hover/pin ever reports the wrong tile, the cause is almost certainly mixing `pos` and `physical(coord)`. Everything stays in `pos`; corners come from `posByCoord`. Do not call `physical()` in the explorer.
- **Patch level.** `PATCH_LEVEL = 10` is the starting point (≈55k faces, ≈350ms build, world radius ≈123 edges). If first paint feels slow on a laptop, drop to 9 (≈21k faces) and note the smaller roam radius. This is a tuning constant, not an architectural choice.
- **No palette yet.** Interim colors are `--color-moment-1/4`. The B1 Mosaic tokens, the pin's `--ink` ring, and the DESIGN.md amendments are the next plan (gated on maintainer sign-off).
- **Deferred to the teaching-spine plan:** landing/explore copy rewrite off the new addressing story (the `labs[]` blurb and both `page.tsx` files still say "de Bruijn pentagrid"), the Sketch harness, and sketches 1–5.
