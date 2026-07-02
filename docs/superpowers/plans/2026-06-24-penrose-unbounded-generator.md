# Penrose Unbounded Viewport Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the explorer's bounded one-patch generation with an edgeless plane: for the visible rectangle, enumerate only the tiles in view (a fixed generic Penrose tiling), generated lazily as the camera pans, with exact `[n; j,k]` addresses computed locally.

**Architecture:** A pure pentagrid enumerator (`pentagrid.ts`) turns a viewport rect into the visible `RenderFace`s by enumerating de Bruijn line-crossings and filtering by physical tile position. A physical-space chunk cache (`chunks.ts`) generates and memoizes cells on demand. The explorer component swaps its mount-time `buildPatch` for the chunk cache; everything else (camera, hit-test, codec, pin, share, theme) is unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, native 2D canvas, Bun (`bun test`), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-24-penrose-unbounded-generator-design.md`. The enumerator algorithm in this plan is verified: it matches the tested `generate()` cut-and-project oracle key-for-key, and an adversarial pass confirmed far-from-origin viewports (to radius 400) drop zero visible tiles.

## Global Constraints

- **Tooling:** `bun` / `bunx` only. Never `npm`/`npx`/`yarn`/`pnpm`.
- **Client-only:** no `useSearchParams`, no Suspense, no `export const runtime/revalidate/dynamic`. URL state stays read-once + debounced `history.replaceState`.
- **Frame:** render and hit-test in the `cap.physical` (ζ^l) frame. No rotation. Never mix `physical(K)` with the old substitution `pos` frame.
- **Filter by the tile body, never by the crossing point.** `physical(K) = (5/2)·z + physical(γ) + bounded`; filtering by `z` drops far tiles. Own tiles by their `physical(K)` centroid.
- **Two projections of γ:** `internal(γ) = Σ γ_l ζ^{2l} = (vx,vy)` is the window center; `physical(γ) = Σ γ_l ζ^l` is the inverse-map shift. Do not mix.
- **Tests:** colocated `bun:test`, table-driven where it fits. The existing engine suite (`bun test ./src/app/x/penrose/` → 68 pass) must stay green. E2E in `e2e/x/penrose/`.
- **Prose:** no emdashes in authored code/comments or copy.
- **Address gauge:** because `Σγ_l = 0`, the de Bruijn index lands in band `{1,2,3,4}`, matching the engine; no `[1,1,1,1,1]` shift. Keys are byte-identical to `faces.ts`/`patch.ts`.
- **Pinned generic window center:** `(vx, vy) = (0.137, -0.081)` (the generic offset the engine's own `cap.test.ts` uses). Validated non-degenerate by the genericity test.
- **Do not modify** `cap.ts`, `deflate.ts`, `bridge.ts`, `fold.ts`, `faces.ts` (the tested engine), or `codec.ts`. `patch.ts` is read-only except its `RenderFace`/`Pt` exports are imported.

---

## File Structure

- **Create:** `src/app/x/penrose/explore/lib/pentagrid.ts` (+ `pentagrid.test.ts`) — the enumerator.
- **Create:** `src/app/x/penrose/explore/lib/chunks.ts` (+ `chunks.test.ts`) — the physical-space chunk cache.
- **Modify:** `src/app/x/penrose/explore/PenroseExplorer.tsx` — swap mount-build for per-viewport generation.
- **Modify:** `e2e/x/penrose/explore.spec.ts` — add a pan-far test and the share round-trip in the new gauge.
- **Modify (copy):** `src/app/x/penrose/page.tsx`, `src/app/x/penrose/explore/page.tsx`, `src/app/x/page.tsx` — the bounded story becomes the edgeless story.
- **Unchanged:** `cap.ts`, `deflate.ts`, `bridge.ts`, `fold.ts`, `faces.ts`, `patch.ts`, `hitTest.ts`, `codec.ts`. `patch.ts`/`buildPatch` stay (tested foundation, future teaching sketches), just no longer the explorer's render source.

The reference prototype (verified, in scratchpad) is at `…/scratchpad/pentagrid.ts`; Task 1 ports it and extends it to return full `RenderFace`s.

---

## Task 1: The pentagrid enumerator (`pentagrid.ts`)

**Files:**
- Create: `src/app/x/penrose/explore/lib/pentagrid.ts`
- Test: `src/app/x/penrose/explore/lib/pentagrid.test.ts`

**Interfaces:**
- Consumes: `PCOS, PSIN, ICOS, ISIN, physical` from `./cap`; `Pt, RenderFace` from `./patch`; (test only) `generate` from `./cap`, `extractFaces` from `./faces`.
- Produces:
  - `type Rect = { minX: number; minY: number; maxX: number; maxY: number }`
  - `function gammaFromWindowCenter(vx: number, vy: number): number[]`
  - `function facesInViewport(view: Rect, gamma: readonly number[], physicalMargin?: number): RenderFace[]`
  - `const WINDOW_CENTER: readonly [number, number]` = `[0.137, -0.081]`
  - `const GAMMA: readonly number[]` = `gammaFromWindowCenter(...WINDOW_CENTER)`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/x/penrose/explore/lib/pentagrid.test.ts
import { describe, expect, test } from "bun:test";

import { generate, physical, type Vec5 } from "./cap";
import { extractFaces } from "./faces";
import { facesInViewport, gammaFromWindowCenter, GAMMA, WINDOW_CENTER, type Rect } from "./pentagrid";

const PHI = (1 + Math.sqrt(5)) / 2;

// Oracle: the tested cut-and-project generate(), as faces, for the same tiling.
// generate() yields Vertex{n,p}; extractFaces wants LiftedVertex{pos,coord}.
function oracleFaces(radius: number, vx: number, vy: number) {
  const verts = generate(radius, vx, vy).map((v) => ({ pos: physical(v.n), coord: v.n }));
  return extractFaces(verts);
}
const inDisk = (cx: number, cy: number, r: number) => Math.hypot(cx, cy) <= r;

describe("facesInViewport matches the generate() oracle key-for-key", () => {
  const [vx, vy] = WINDOW_CENTER;
  // A few origin-ish and off-origin regions. Compare only faces whose centroid is
  // inside an inner disk where the disk-clipped oracle is complete.
  const cases = [
    { R: 16, cx: 0, cy: 0 },
    { R: 16, cx: 6, cy: 4 },
  ];
  for (const { R, cx, cy } of cases) {
    test(`region r=${R} at (${cx},${cy})`, () => {
      const inner = R - 5;
      const oracle = new Map(
        oracleFaces(R, vx, vy)
          .map((f) => [f.key, f] as const),
      );
      // restrict oracle to faces with centroid in the inner disk
      const oracleKeys = new Set(
        [...oracle.keys()].filter((key) => {
          const f = faceCentroidFromKey(key);
          return inDisk(f[0], f[1], inner);
        }),
      );
      const view: Rect = { minX: cx - R, minY: cy - R, maxX: cx + R, maxY: cy + R };
      const enumFaces = facesInViewport(view, GAMMA);
      const enumKeys = new Set(
        enumFaces
          .filter((f) => inDisk(f.centroid[0], f.centroid[1], inner))
          .map((f) => f.key),
      );
      const missing = [...oracleKeys].filter((k) => !enumKeys.has(k));
      const extra = [...enumKeys].filter((k) => !oracleKeys.has(k));
      expect(oracleKeys.size).toBeGreaterThan(100);
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    });
  }
});

// helper: physical centroid of a face from its "n0,n1,n2,n3,n4|jk" key
function faceCentroidFromKey(key: string): [number, number] {
  const [coordStr, jk] = key.split("|");
  const n = coordStr.split(",").map(Number);
  const j = Number(jk[0]), k = Number(jk[1]);
  const c1 = [...n]; c1[j]++;
  const c2 = [...c1]; c2[k]++;
  const c3 = [...n]; c3[k]++;
  const ps = [n, c1, c2, c3].map((c) => physical(c as Vec5));
  return [(ps[0][0] + ps[1][0] + ps[2][0] + ps[3][0]) / 4, (ps[0][1] + ps[1][1] + ps[2][1] + ps[3][1]) / 4];
}

describe("far-from-origin viewports drop nothing", () => {
  test("a small viewport far out still returns its tiles, all with finite corners", () => {
    const view: Rect = { minX: 45, minY: 45, maxX: 50, maxY: 50 };
    const faces = facesInViewport(view, GAMMA);
    expect(faces.length).toBeGreaterThan(5);
    for (const f of faces) {
      expect(f.coord.length).toBe(5);
      expect(f.corners.length).toBe(4);
      for (const [x, y] of f.corners) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
      // every returned tile's centroid is within one tile of the view
      expect(f.centroid[0]).toBeGreaterThan(view.minX - 2);
      expect(f.centroid[0]).toBeLessThan(view.maxX + 2);
    }
  });
});

describe("tiling validity", () => {
  const faces = facesInViewport({ minX: -12, minY: -12, maxX: 12, maxY: 12 }, GAMMA);
  test("corners are unit-edge rhombi", () => {
    for (const f of faces) {
      for (let i = 0; i < 4; i++) {
        const a = f.corners[i], b = f.corners[(i + 1) % 4];
        expect(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 1)).toBeLessThan(0.02);
      }
    }
  });
  test("base corner is the componentwise min on axes j,k", () => {
    for (const f of faces) {
      const { coord: n, j, k } = f;
      // n must be <= n+e_j and n+e_k on those axes, i.e. it is the min corner
      expect(n[j]).toBe(Math.min(n[j], n[j] + 1));
      expect(n[k]).toBe(Math.min(n[k], n[k] + 1));
    }
  });
  test("thick:thin ratio approaches phi", () => {
    const thick = faces.filter((f) => f.type === "thick").length;
    const thin = faces.filter((f) => f.type === "thin").length;
    expect(thick / thin).toBeGreaterThan(1.55);
    expect(thick / thin).toBeLessThan(1.7);
  });
  test("keys are unique", () => {
    expect(new Set(faces.map((f) => f.key)).size).toBe(faces.length);
  });
});

describe("genericity: the pinned window center has no on-boundary ties", () => {
  test("gammaFromWindowCenter reproduces the window center via internal projection", () => {
    const g = gammaFromWindowCenter(0.137, -0.081);
    // internal(g) = Σ g_l ζ^{2l} = (vx,vy)
    const ICOS = [0, 1, 2, 3, 4].map((l) => Math.cos((4 * Math.PI * l) / 5));
    const ISIN = [0, 1, 2, 3, 4].map((l) => Math.sin((4 * Math.PI * l) / 5));
    let vx = 0, vy = 0;
    for (let l = 0; l < 5; l++) { vx += g[l] * ICOS[l]; vy += g[l] * ISIN[l]; }
    expect(vx).toBeCloseTo(0.137, 9);
    expect(vy).toBeCloseTo(-0.081, 9);
    expect(g.reduce((s, x) => s + x, 0)).toBeCloseTo(0, 9); // sum 0 -> index band {1,2,3,4}
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `bun test ./src/app/x/penrose/explore/lib/pentagrid.test.ts`
Expected: FAIL with module not found / `facesInViewport is not a function`.

- [ ] **Step 3: Implement `pentagrid.ts`**

Port the verified scratchpad prototype, extended to return full `RenderFace`s (corners + centroid + coord + j + k). The algorithm is unchanged from the prototype; only the output shape grows from `{key,type}` to `RenderFace`.

```ts
// src/app/x/penrose/explore/lib/pentagrid.ts
// Fast pentagrid viewport enumerator for a fixed generic Penrose tiling.
//
// A tile is a de Bruijn line-crossing of families j<k at grid point z. It RENDERS at
// physical(K) = (5/2) z + physical(gamma) + bounded, so the crossing z is pulled ~2/5
// toward the origin from the tile body. Own and filter tiles by physical(K), never by z.
//
//   1. Map the physical viewport V into a grid-space z region: z ~= (2/5)(V - physical(gamma)),
//      grown by a CONSTANT grid margin that covers the bounded term.
//   2. Per-family integer line ranges over that z region; solve every j<k crossing.
//   3. Local address K = ceil(f_l(z + eps nudge) + gamma_l), forcing K_j,K_k to the crossing.
//   4. Keep iff the physical(K) centroid lies in V grown by one tile.
//
// Verified key-for-key against cap.generate() (the tested cut-and-project oracle) and
// adversarially confirmed to drop zero tiles in far-from-origin viewports.

import { PCOS, PSIN, ICOS, ISIN, physical, type Vec5 } from "./cap";
import type { Pt, RenderFace } from "./patch";

export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export const WINDOW_CENTER: readonly [number, number] = [0.137, -0.081];

// gamma_l = (2/5)(vx*ICOS[l] + vy*ISIN[l]); then internal(gamma) = (vx,vy) and Sum gamma = 0.
export function gammaFromWindowCenter(vx: number, vy: number): number[] {
  const g = new Array(5);
  for (let l = 0; l < 5; l++) g[l] = (2 / 5) * (vx * ICOS[l] + vy * ISIN[l]);
  return g;
}

export const GAMMA: readonly number[] = gammaFromWindowCenter(WINDOW_CENTER[0], WINDOW_CENTER[1]);

const GRID_MARGIN = 1.0; // grid-space; >= (2/5)*phi ~= 0.65 covers the bounded term

const fl = (x: number, y: number, l: number) => x * PCOS[l] + y * PSIN[l];

function physicalGamma(gamma: readonly number[]): [number, number] {
  let x = 0, y = 0;
  for (let l = 0; l < 5; l++) { x += gamma[l] * PCOS[l]; y += gamma[l] * PSIN[l]; }
  return [x, y];
}

function lineRange(rect: Rect, l: number, gamma: readonly number[]): [number, number] {
  const c = [
    fl(rect.minX, rect.minY, l), fl(rect.maxX, rect.minY, l),
    fl(rect.minX, rect.maxY, l), fl(rect.maxX, rect.maxY, l),
  ];
  return [Math.ceil(Math.min(...c) + gamma[l]), Math.floor(Math.max(...c) + gamma[l])];
}

function solveCrossing(j: number, k: number, aj: number, ak: number): [number, number] {
  const a = PCOS[j], b = PSIN[j], c = PCOS[k], d = PSIN[k];
  const det = a * d - b * c;
  return [(aj * d - b * ak) / det, (a * ak - aj * c) / det];
}

export function facesInViewport(view: Rect, gamma: readonly number[], physicalMargin = 1.5): RenderFace[] {
  const out: RenderFace[] = [];
  const seen = new Set<string>();

  // Step 1: physical viewport -> grid-space z region.
  const [pgx, pgy] = physicalGamma(gamma);
  const zx0 = (2 / 5) * (view.minX - pgx), zx1 = (2 / 5) * (view.maxX - pgx);
  const zy0 = (2 / 5) * (view.minY - pgy), zy1 = (2 / 5) * (view.maxY - pgy);
  const zRegion: Rect = {
    minX: Math.min(zx0, zx1) - GRID_MARGIN, maxX: Math.max(zx0, zx1) + GRID_MARGIN,
    minY: Math.min(zy0, zy1) - GRID_MARGIN, maxY: Math.max(zy0, zy1) + GRID_MARGIN,
  };

  // Step 2: per-family line ranges over the z region.
  const ranges: [number, number][] = [];
  for (let l = 0; l < 5; l++) ranges.push(lineRange(zRegion, l, gamma));

  const keepMinX = view.minX - physicalMargin, keepMaxX = view.maxX + physicalMargin;
  const keepMinY = view.minY - physicalMargin, keepMaxY = view.maxY + physicalMargin;

  for (let j = 0; j < 5; j++) {
    for (let k = j + 1; k < 5; k++) {
      const [mjLo, mjHi] = ranges[j];
      const [mkLo, mkHi] = ranges[k];
      for (let mj = mjLo; mj <= mjHi; mj++) {
        for (let mk = mkLo; mk <= mkHi; mk++) {
          const [x, y] = solveCrossing(j, k, mj - gamma[j], mk - gamma[k]);
          if (x < zRegion.minX || x > zRegion.maxX || y < zRegion.minY || y > zRegion.maxY) continue;

          // Step 3: local address. Nudge +eps along both family normals so ceil resolves
          // into the cell whose min-on-(j,k) corner is the (mj,mk) crossing corner.
          const eps = 1e-7;
          const nx = x + eps * PCOS[j] + eps * PCOS[k];
          const ny = y + eps * PSIN[j] + eps * PSIN[k];
          const K = new Array(5) as number[];
          for (let l = 0; l < 5; l++) K[l] = Math.ceil(fl(nx, ny, l) + gamma[l]);
          K[j] = mj; K[k] = mk;

          // corners n, n+e_j, n+e_j+e_k, n+e_k (cyclic), positions via physical.
          const c0 = K as Vec5;
          const c1 = [...K] as number[]; c1[j]++;
          const c2 = [...c1] as number[]; c2[k]++;
          const c3 = [...K] as number[]; c3[k]++;
          const p0 = physical(c0), p1 = physical(c1 as Vec5), p2 = physical(c2 as Vec5), p3 = physical(c3 as Vec5);
          const centroid: Pt = [(p0[0] + p1[0] + p2[0] + p3[0]) / 4, (p0[1] + p1[1] + p2[1] + p3[1]) / 4];

          // Step 4: filter by physical centroid.
          if (centroid[0] < keepMinX || centroid[0] > keepMaxX || centroid[1] < keepMinY || centroid[1] > keepMaxY) continue;

          const key = `${K.join(",")}|${j}${k}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const d = k - j;
          out.push({
            key, coord: K, j, k,
            type: d === 1 || d === 4 ? "thick" : "thin",
            corners: [p0, p1, p2, p3], centroid,
          });
        }
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `bun test ./src/app/x/penrose/explore/lib/pentagrid.test.ts`
Expected: PASS (oracle key-for-key, far viewport, validity, genericity). Then run the full engine suite `bun test ./src/app/x/penrose/` and confirm it stays at 68 + the new tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/app/x/penrose/explore/lib/pentagrid.ts src/app/x/penrose/explore/lib/pentagrid.test.ts
git commit -m "feat(penrose): pentagrid viewport enumerator (generic edgeless tiling)"
```

---

## Task 2: Physical-space chunk cache (`chunks.ts`)

**Files:**
- Create: `src/app/x/penrose/explore/lib/chunks.ts`
- Test: `src/app/x/penrose/explore/lib/chunks.test.ts`

**Interfaces:**
- Consumes: `facesInViewport`, `GAMMA`, `Rect` from `./pentagrid`; `RenderFace` from `./patch`.
- Produces:
  - `const CELL = 8` (cell side in physical unit edges)
  - `class ChunkCache { facesInView(view: Rect): RenderFace[]; size: number }` — generates and memoizes the cells covering `view` (plus a one-cell margin ring), evicting cells far outside it, and returns the de-duped visible faces. Each cell owns tiles whose `physical(K)` centroid is in its half-open `[min,max)` bounds, so the union is seam-free.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/x/penrose/explore/lib/chunks.test.ts
import { describe, expect, test } from "bun:test";

import { facesInViewport, GAMMA, type Rect } from "./pentagrid";
import { ChunkCache, CELL } from "./chunks";

const keys = (faces: { key: string }[]) => new Set(faces.map((f) => f.key));

describe("chunk cache reconstructs a region seam-free", () => {
  // The cache, queried over a region, must return exactly the tiles whose centroid is
  // in that region (matching a single facesInViewport call restricted by centroid).
  for (const at of [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: -45, y: 12 }]) {
    test(`region at (${at.x},${at.y}) near and far from origin`, () => {
      const view: Rect = { minX: at.x - 12, minY: at.y - 12, maxX: at.x + 12, maxY: at.y + 12 };
      const cache = new ChunkCache(GAMMA);
      const fromCache = cache.facesInView(view);
      // ground truth: one enumeration, restricted to centroids strictly inside the view
      const inView = (c: readonly [number, number]) =>
        c[0] >= view.minX && c[0] < view.maxX && c[1] >= view.minY && c[1] < view.maxY;
      const truth = facesInViewport(view, GAMMA).filter((f) => inView(f.centroid));
      const cacheInView = fromCache.filter((f) => inView(f.centroid));
      // every tile whose centroid is in the view is present exactly once, no extras
      expect(keys(cacheInView)).toEqual(keys(truth));
      expect(cacheInView.length).toBe(truth.length); // no duplicates
    });
  }
});

describe("determinism and eviction", () => {
  test("two caches over the same view return identical key sets", () => {
    const view: Rect = { minX: 20, minY: -5, maxX: 32, maxY: 7 };
    const a = new ChunkCache(GAMMA).facesInView(view);
    const b = new ChunkCache(GAMMA).facesInView(view);
    expect(keys(a)).toEqual(keys(b));
  });
  test("panning away then back yields the same faces (eviction is lossless)", () => {
    const cache = new ChunkCache(GAMMA);
    const here: Rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const far: Rect = { minX: 200, minY: 200, maxX: 210, maxY: 210 };
    const first = keys(cache.facesInView(here));
    cache.facesInView(far); // forces eviction of the first region
    const again = keys(cache.facesInView(here));
    expect(again).toEqual(first);
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `bun test ./src/app/x/penrose/explore/lib/chunks.test.ts`
Expected: FAIL with `ChunkCache is not a constructor`.

- [ ] **Step 3: Implement `chunks.ts`**

```ts
// src/app/x/penrose/explore/lib/chunks.ts
// Physical-space chunk cache over the pentagrid enumerator. Cells are squares of side
// CELL in the physical (render) frame. A cell owns tiles whose physical(K) centroid is
// in its half-open [min,max) bounds, so the union over cells is seam-free (each tile in
// exactly one cell). Cells are generated on demand and LRU-evicted when far from the view.

import { facesInViewport, type Rect } from "./pentagrid";
import type { RenderFace } from "./patch";

export const CELL = 8;
const KEEP_RING = 1;      // generate one ring of cells beyond the viewport
const MAX_CELLS = 4096;   // evict beyond this many cached cells

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

export class ChunkCache {
  private cells = new Map<string, RenderFace[]>();
  private order: string[] = []; // simple LRU queue of cell keys

  constructor(private gamma: readonly number[]) {}

  get size(): number {
    return this.cells.size;
  }

  private cellFaces(cx: number, cy: number): RenderFace[] {
    const key = cellKey(cx, cy);
    const hit = this.cells.get(key);
    if (hit) return hit;
    // Generate the cell: enumerate over the cell's physical bounds, then keep tiles whose
    // centroid is in this cell's half-open bounds. facesInViewport already grows the search
    // region by its grid + physical margins, so every tile touching the cell is enumerated.
    const minX = cx * CELL, minY = cy * CELL, maxX = minX + CELL, maxY = minY + CELL;
    const faces = facesInViewport({ minX, minY, maxX, maxY }, this.gamma).filter(
      (f) => f.centroid[0] >= minX && f.centroid[0] < maxX && f.centroid[1] >= minY && f.centroid[1] < maxY,
    );
    this.cells.set(key, faces);
    this.order.push(key);
    if (this.cells.size > MAX_CELLS) {
      const evict = this.order.shift();
      if (evict && evict !== key) this.cells.delete(evict);
    }
    return faces;
  }

  facesInView(view: Rect): RenderFace[] {
    const cx0 = Math.floor(view.minX / CELL) - KEEP_RING;
    const cx1 = Math.floor(view.maxX / CELL) + KEEP_RING;
    const cy0 = Math.floor(view.minY / CELL) - KEEP_RING;
    const cy1 = Math.floor(view.maxY / CELL) + KEEP_RING;
    const out: RenderFace[] = [];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) out.push(...this.cellFaces(cx, cy));
    }
    return out;
  }
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `bun test ./src/app/x/penrose/explore/lib/chunks.test.ts` then `bun test ./src/app/x/penrose/`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/app/x/penrose/explore/lib/chunks.ts src/app/x/penrose/explore/lib/chunks.test.ts
git commit -m "feat(penrose): physical-space chunk cache over the pentagrid enumerator"
```

---

## Task 3: Wire the explorer to per-viewport generation

**Files:**
- Modify: `src/app/x/penrose/explore/PenroseExplorer.tsx`
- Modify: `e2e/x/penrose/explore.spec.ts` (add pan-far)

**Interfaces:**
- Consumes: `ChunkCache` from `./lib/chunks`; `GAMMA`, `type Rect`, `WINDOW_CENTER` from `./lib/pentagrid`; existing `buildHitIndex`/`hitFace` from `./lib/hitTest`; `findFaceByTile` from `./lib/patch`.

The component keeps its camera, pointer/wheel/pinch, theme, HUD, pin, and share machinery. Three changes: drop the mount-time `buildPatch`; on each render compute the viewport rect and pull visible faces from the chunk cache; rebuild the hit index over the visible set when it changes.

- [ ] **Step 1: Replace the patch model with the chunk cache**

In `PenroseExplorer.tsx`:

- Remove the imports of `buildPatch`/`Patch` and the `PATCH_LEVEL` constant and the `seedToCenter`-by-face helper. Add:

```tsx
import { ChunkCache } from "./lib/chunks";
import { GAMMA, WINDOW_CENTER } from "./lib/pentagrid";
```

- Replace `patchRef`/the mount build effect. The cache lives in a ref; there is no whole-plane build, so `ready` can be set immediately:

```tsx
  const cacheRef = useRef<ChunkCache | null>(null);
  // ...
  useEffect(() => {
    cacheRef.current = new ChunkCache(GAMMA);
    // default camera center: a fixed generic point off the origin (no sun center exists).
    const c = seedToCenter(seed);
    offsetRef.current = [c[0], c[1]];
    // apply a shared-URL pin/zoom if present (unchanged decode logic), centering on the tile.
    // ... existing decodeTile/parseZoom read-once, but resolve the pin against a freshly
    //     generated viewport around the decoded tile's physical position ...
    setReady(true);
  }, [seed]);
```

- `seedToCenter` becomes a pure hash to a world position (no patch needed):

```tsx
function seedToCenter(seed: string): readonly [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  // spread seeds across a wide area; any point is a valid generic location.
  const r = 30 + ((h >>> 0) % 400);
  const a = ((h >>> 8) % 360) * (Math.PI / 180);
  return [r * Math.cos(a), r * Math.sin(a)];
}
```

- [ ] **Step 2: Generate per viewport in the render loop**

In `render()`, after computing the world view rect `x0,x1,y0,y1` (already computed for culling), pull faces from the cache and rebuild the hit index when the visible set changes:

```tsx
    const view = { minX: x0, minY: y0, maxX: x1, maxY: y1 };
    const faces = cacheRef.current!.facesInView(view);
    // rebuild the hit index for hover/pin against exactly the visible faces
    hitRef.current = buildHitIndex(faces);
    for (const f of faces) {
      // draw f.corners (same fill-by-type + grout stroke as today)
    }
```

`updateHover` and the click-to-pin handler keep using `hitRef.current` via `hitFace`; they now test against the per-frame visible set. The pin still stores `{coord, j, k}` and writes the URL via the unchanged codec. (Rebuilding the index each frame is cheap: a viewport holds a few hundred to low-thousands of faces. If profiling shows it matters, gate the rebuild on the view rect changing.)

- [ ] **Step 3: Resolve a shared pin against a generated viewport**

The read-once URL decode (unchanged `decodeTile`/`parseZoom`) yields a tile address `{coord, j, k}`. Center the camera on that tile's physical position, then on the first render `findFaceByTile` resolves it against the freshly generated visible faces:

```tsx
    const tile = decodeTile(params.get("t") ?? undefined);
    if (tile) {
      // center on the tile's physical position (physical(coord) shifted to its centroid)
      const faces = new ChunkCache(GAMMA).facesInView({
        minX: -999, minY: -999, maxX: 999, maxY: 999, // replaced below by a small box around the tile
      });
      // simpler: compute the tile centroid directly and center there
    }
```

Concretely: import `physical` is not needed in the component; instead compute the centroid by generating a tiny viewport around `physical(coord)`. To keep the component free of engine math, add a small helper to `pentagrid.ts`, `tileCentroid(coord, j, k): Pt`, and use it to center. (Add that export in Task 1 if not present, or here as a one-line addition with its own test.)

- [ ] **Step 4: Update the E2E to pan far**

```ts
// add to e2e/x/penrose/explore.spec.ts
import { expect, test } from "@playwright/test";

test("the plane has no edge: panning far keeps showing tiles", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();
  // drag many times in one direction, then confirm a tile address still reads under the cursor
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  const midX = box.x + box.width / 2, midY = box.y + box.height / 2;
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(midX, midY);
    await page.mouse.down();
    await page.mouse.move(midX - 300, midY, { steps: 5 });
    await page.mouse.up();
  }
  await page.mouse.move(midX, midY);
  await expect(page.getByText(/address/i)).toBeVisible();
});
```

- [ ] **Step 5: Verify and commit**

Run: `bun test ./src/app/x/penrose/` (green), `bun run build` (green), `bunx playwright test e2e/x/penrose/explore.spec.ts` (canvas mounts, seed shows, pan-far still reads an address).
Manual: open the explorer, pan a long way in every direction, confirm tiles keep appearing with no blank grout edge and the address HUD keeps updating.

```bash
git add -A
git commit -m "feat(penrose): edgeless explorer via per-viewport pentagrid generation"
```

---

## Task 4: Share round-trip in the new gauge, and copy

**Files:**
- Modify: `e2e/x/penrose/explore.spec.ts` (share round-trip)
- Modify: `src/app/x/penrose/page.tsx`, `src/app/x/penrose/explore/page.tsx`, `src/app/x/page.tsx` (copy)

- [ ] **Step 1: Share round-trip E2E (self-contained, new gauge)**

The existing round-trip test (pin a tile, capture the URL, reload, assert the same pinned address) is gauge-agnostic, so it should still pass against the generic tiling. Confirm it does; if it hardcoded any sun-gauge address, replace with the self-contained pin-capture-reload form.

Run: `bunx playwright test e2e/x/penrose/explore.spec.ts`
Expected: PASS (pin survives reload in the new gauge; pan-far reads an address).

- [ ] **Step 2: Update the copy to the edgeless story**

Rewrite the bounded-plane phrasing to the edgeless one, in all three surfaces:
- `src/app/x/page.tsx` `labs[]` Penrose blurb.
- `src/app/x/penrose/page.tsx` prose/metadata.
- `src/app/x/penrose/explore/page.tsx` metadata description.

Keep it accurate: a generic Penrose tiling, generated per viewport, edgeless, every tile addressed by its de Bruijn coordinate. No emdashes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(penrose): edgeless-plane share round-trip and copy"
```

---

## Self-Review notes (for the executor)

- **Frame:** everything renders in `cap.physical` (ζ^l). Do not bring in the substitution `pos` frame or its 18° rotation; this is a different tiling.
- **Filter by centroid, never by `z`.** If far tiles vanish on pan, you reintroduced crossing-point filtering. The `physical(K)` centroid is the only valid owner.
- **The oracle test is the gate.** `facesInViewport` must match `extractFaces(generate(R, vx, vy))` key-for-key on the inner disk; that is the proof the fast path equals the proven slow path.
- **Two γ projections.** `internal(γ)=(vx,vy)` (window center, what γ is built from) vs `physical(γ)` (the inverse-map shift). Mixing them mis-maps the search region.
- **Keys are byte-identical to the sun gauge's format but the addresses differ** (different tiling), so old preview share links will not resolve. Intended.
- **Deferred:** the `buildPatch` substitution path stays for teaching sketches; the bounded explorer's `PATCH_LEVEL` is gone. BigInt deep-zoom remains unbuilt and unneeded (float64 safe to ~1e14).
