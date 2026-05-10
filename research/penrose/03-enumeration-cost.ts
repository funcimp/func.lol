// research/penrose/03-enumeration-cost.ts
//
// Q: How fast is enumerateTilesInRect for the de Bruijn pentagrid
//    construction? Target <4ms at ~1500 tiles to match the performance
//    budget in the plan file.
//
// Method: a self-contained pentagrid enumerator. For each pair (j, k)
//   of grid directions (10 pairs), enumerate integer line indices
//   (kj, kk) whose intersection vertex falls in the rect. Each such
//   vertex corresponds to a P3 rhombus tile; the tile's pentagrid coord
//   is the 5-tuple of floors at the vertex.
//
// Run multiple rect sizes targeting ~500, ~1500, ~3000 tiles. Report
// mean and p95 ms over 50 timed runs.
//
// Run: bun run research/penrose/03-enumeration-cost.ts

const E: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: 5 },
  (_, j) => {
    const a = (2 * Math.PI * j) / 5;
    return [Math.cos(a), Math.sin(a)] as const;
  },
);

function gammaFromSeed(seed: string): readonly number[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const gs = new Array(5).fill(0).map((_, i) => {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0;
    return h / 0xffffffff - 0.5;
  });
  const m = gs.reduce((a, b) => a + b, 0) / 5;
  return gs.map((g) => g - m);
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

function enumerateTiles(gamma: readonly number[], rect: Rect): number {
  const seen = new Set<string>();
  for (let j = 0; j < 4; j++) {
    for (let k = j + 1; k < 5; k++) {
      const ejx = E[j][0], ejy = E[j][1];
      const ekx = E[k][0], eky = E[k][1];
      const det = ejx * eky - ejy * ekx;
      if (Math.abs(det) < 1e-12) continue;
      const invDet = 1 / det;
      // Bound the line-index ranges by projecting rect corners onto e_j, e_k.
      const pj0 = rect.x0 * ejx + rect.y0 * ejy;
      const pj1 = rect.x1 * ejx + rect.y0 * ejy;
      const pj2 = rect.x0 * ejx + rect.y1 * ejy;
      const pj3 = rect.x1 * ejx + rect.y1 * ejy;
      const pk0 = rect.x0 * ekx + rect.y0 * eky;
      const pk1 = rect.x1 * ekx + rect.y0 * eky;
      const pk2 = rect.x0 * ekx + rect.y1 * eky;
      const pk3 = rect.x1 * ekx + rect.y1 * eky;
      const kjMin = Math.floor(Math.min(pj0, pj1, pj2, pj3) + gamma[j]) - 1;
      const kjMax = Math.ceil(Math.max(pj0, pj1, pj2, pj3) + gamma[j]) + 1;
      const kkMin = Math.floor(Math.min(pk0, pk1, pk2, pk3) + gamma[k]) - 1;
      const kkMax = Math.ceil(Math.max(pk0, pk1, pk2, pk3) + gamma[k]) + 1;
      for (let kj = kjMin; kj <= kjMax; kj++) {
        const aj = kj - gamma[j];
        for (let kk = kkMin; kk <= kkMax; kk++) {
          const ak = kk - gamma[k];
          const px = (eky * aj - ejy * ak) * invDet;
          const py = (-ekx * aj + ejx * ak) * invDet;
          if (px < rect.x0 || px > rect.x1 || py < rect.y0 || py > rect.y1) continue;
          const t0 = j === 0 ? kj : k === 0 ? kk : Math.floor(px * E[0][0] + py * E[0][1] + gamma[0]);
          const t1 = j === 1 ? kj : k === 1 ? kk : Math.floor(px * E[1][0] + py * E[1][1] + gamma[1]);
          const t2 = j === 2 ? kj : k === 2 ? kk : Math.floor(px * E[2][0] + py * E[2][1] + gamma[2]);
          const t3 = j === 3 ? kj : k === 3 ? kk : Math.floor(px * E[3][0] + py * E[3][1] + gamma[3]);
          const t4 = j === 4 ? kj : k === 4 ? kk : Math.floor(px * E[4][0] + py * E[4][1] + gamma[4]);
          seen.add(`${t0},${t1},${t2},${t3},${t4}`);
        }
      }
    }
  }
  return seen.size;
}

const gamma = gammaFromSeed("funclol");

// Calibrate rect sizes by trying a few and reporting actual tile counts.
const TRY_SIZES = [
  { name: "small",  rect: { x0: -6, y0: -4, x1: 6, y1: 4 } },
  { name: "medium", rect: { x0: -12, y0: -7, x1: 12, y1: 7 } },
  { name: "large",  rect: { x0: -18, y0: -11, x1: 18, y1: 11 } },
  { name: "x-large", rect: { x0: -24, y0: -15, x1: 24, y1: 15 } },
];

// Warm up
for (let i = 0; i < 5; i++) enumerateTiles(gamma, TRY_SIZES[1].rect);

console.log(`seed=funclol\n`);
console.log("size      rect (w×h units)   tiles   mean_ms   p95_ms    runs");
console.log("--------  -----------------  ------  --------  --------  ----");

for (const { name, rect } of TRY_SIZES) {
  const N = 50;
  const times: number[] = [];
  let count = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    count = enumerateTiles(gamma, rect);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(0.95 * times.length)];
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  console.log(
    `${name.padEnd(8)}  ${`${w}×${h}`.padEnd(17)}  ${String(count).padEnd(6)}  ${mean.toFixed(2).padEnd(8)}  ${p95.toFixed(2).padEnd(8)}  ${N}`,
  );
}

// Pick the closest run to 1500 tiles, report the verdict.
const target = 1500;
let bestRun: { tiles: number; mean: number; p95: number } | null = null;
for (const { rect } of TRY_SIZES) {
  const times: number[] = [];
  let count = 0;
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    count = enumerateTiles(gamma, rect);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(0.95 * times.length)];
  if (bestRun === null || Math.abs(count - target) < Math.abs(bestRun.tiles - target)) {
    bestRun = { tiles: count, mean, p95 };
  }
}

if (bestRun) {
  const verdict = bestRun.p95 < 4 ? "PASS" : "FAIL";
  console.log(
    `\nsummary: nearest-to-1500 = ${bestRun.tiles} tiles, p95 ${bestRun.p95.toFixed(2)}ms — ${verdict} vs <4ms budget`,
  );
}
