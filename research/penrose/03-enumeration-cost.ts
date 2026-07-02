// research/penrose/03-enumeration-cost.ts
//
// Q: How fast is enumerateTilesInRect for the de Bruijn pentagrid
//    construction, in Float64 vs in BigInt-exact?
//
// Float64 sets the lower bound on per-frame cost. BigInt-exact (matching
// 01-coord-representation's high-precision oracle) sets the ceiling.
// The gap between them is the perf tax for "100% correctness at any size"
// in the addressing layer, which decides whether the explorer can stay
// fully exact or needs a viewport-anchor pattern in the render path.
//
// Method: a self-contained pentagrid enumerator, twice. For each pair
//   (j, k) of grid directions, enumerate integer line indices (kj, kk)
//   whose intersection vertex falls in the rect. Each vertex corresponds
//   to a P3 rhombus; the tile's pentagrid coord is the 5-tuple of floors
//   at the vertex. Both implementations use the same seed, same gamma,
//   same rect; only the arithmetic backend differs.
//
// Run multiple rect sizes targeting ~500, ~1500, ~3000 tiles. Report
// mean and p95 ms over 50 timed runs for each implementation.
//
// Run: bun run research/penrose/03-enumeration-cost.ts

const SCALE = 10n ** 50n;
const SCALE_F = Number(SCALE);
const SCALE2 = SCALE * SCALE;

function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("negative");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function bigintFloorDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("div by zero");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n >= 0n) return n / d;
  return n % d === 0n ? n / d : n / d - 1n;
}

const SQRT5 = bigintSqrt(5n * SCALE * SCALE);
const T_PLUS = 10n * SCALE + 2n * SQRT5;
const T_MINUS = 10n * SCALE - 2n * SQRT5;
const SQRT_T_PLUS = bigintSqrt(T_PLUS * SCALE);
const SQRT_T_MINUS = bigintSqrt(T_MINUS * SCALE);

const COS_HI: readonly bigint[] = [
  SCALE,
  bigintFloorDiv(SQRT5 - SCALE, 4n),
  bigintFloorDiv(-(SQRT5 + SCALE), 4n),
  bigintFloorDiv(-(SQRT5 + SCALE), 4n),
  bigintFloorDiv(SQRT5 - SCALE, 4n),
];
const SIN_HI: readonly bigint[] = [
  0n,
  bigintFloorDiv(SQRT_T_PLUS, 4n),
  bigintFloorDiv(SQRT_T_MINUS, 4n),
  bigintFloorDiv(-SQRT_T_MINUS, 4n),
  bigintFloorDiv(-SQRT_T_PLUS, 4n),
];

const COS_F: readonly number[] = COS_HI.map((c) => Number(c) / SCALE_F);
const SIN_F: readonly number[] = SIN_HI.map((s) => Number(s) / SCALE_F);

function gammaFromSeed(seed: string): { exact: readonly bigint[]; float: readonly number[] } {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const raw: bigint[] = [];
  for (let i = 0; i < 5; i++) {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0;
    raw.push((BigInt(h) * SCALE) / (1n << 32n) - SCALE / 2n);
  }
  const sum = raw.reduce((a, b) => a + b, 0n);
  const exact = raw.map((g) => g - sum / 5n);
  const float = exact.map((g) => Number(g) / SCALE_F);
  return { exact, float };
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

function enumerateTilesFloat(gamma: readonly number[], rect: Rect): number {
  const seen = new Set<string>();
  for (let j = 0; j < 4; j++) {
    for (let k = j + 1; k < 5; k++) {
      const ejx = COS_F[j], ejy = SIN_F[j];
      const ekx = COS_F[k], eky = SIN_F[k];
      const det = ejx * eky - ejy * ekx;
      if (Math.abs(det) < 1e-12) continue;
      const invDet = 1 / det;
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
          const t0 = j === 0 ? kj : k === 0 ? kk : Math.floor(px * COS_F[0] + py * SIN_F[0] + gamma[0]);
          const t1 = j === 1 ? kj : k === 1 ? kk : Math.floor(px * COS_F[1] + py * SIN_F[1] + gamma[1]);
          const t2 = j === 2 ? kj : k === 2 ? kk : Math.floor(px * COS_F[2] + py * SIN_F[2] + gamma[2]);
          const t3 = j === 3 ? kj : k === 3 ? kk : Math.floor(px * COS_F[3] + py * SIN_F[3] + gamma[3]);
          const t4 = j === 4 ? kj : k === 4 ? kk : Math.floor(px * COS_F[4] + py * SIN_F[4] + gamma[4]);
          seen.add(`${t0},${t1},${t2},${t3},${t4}`);
        }
      }
    }
  }
  return seen.size;
}

function enumerateTilesExact(gammaBig: readonly bigint[], rect: Rect): number {
  const seen = new Set<string>();
  // Use Float64 to compute integer line-index bounds; the bounds only
  // need to over-cover the rect by 1, so approximate ranging is fine.
  // The actual vertex math runs in BigInt.
  const gammaF = gammaBig.map((g) => Number(g) / SCALE_F);
  for (let j = 0; j < 4; j++) {
    for (let k = j + 1; k < 5; k++) {
      const ejx = COS_HI[j], ejy = SIN_HI[j];
      const ekx = COS_HI[k], eky = SIN_HI[k];
      const det = ejx * eky - ejy * ekx;
      if (det === 0n) continue;
      const ejxF = COS_F[j], ejyF = SIN_F[j], ekxF = COS_F[k], ekyF = SIN_F[k];
      const pj0 = rect.x0 * ejxF + rect.y0 * ejyF;
      const pj1 = rect.x1 * ejxF + rect.y0 * ejyF;
      const pj2 = rect.x0 * ejxF + rect.y1 * ejyF;
      const pj3 = rect.x1 * ejxF + rect.y1 * ejyF;
      const pk0 = rect.x0 * ekxF + rect.y0 * ekyF;
      const pk1 = rect.x1 * ekxF + rect.y0 * ekyF;
      const pk2 = rect.x0 * ekxF + rect.y1 * ekyF;
      const pk3 = rect.x1 * ekxF + rect.y1 * ekyF;
      const kjMin = Math.floor(Math.min(pj0, pj1, pj2, pj3) + gammaF[j]) - 1;
      const kjMax = Math.ceil(Math.max(pj0, pj1, pj2, pj3) + gammaF[j]) + 1;
      const kkMin = Math.floor(Math.min(pk0, pk1, pk2, pk3) + gammaF[k]) - 1;
      const kkMax = Math.ceil(Math.max(pk0, pk1, pk2, pk3) + gammaF[k]) + 1;
      const rectX0Big = BigInt(rect.x0) * SCALE;
      const rectY0Big = BigInt(rect.y0) * SCALE;
      const rectX1Big = BigInt(rect.x1) * SCALE;
      const rectY1Big = BigInt(rect.y1) * SCALE;
      for (let kjN = kjMin; kjN <= kjMax; kjN++) {
        const kj = BigInt(kjN);
        const aj = kj * SCALE - gammaBig[j];
        for (let kkN = kkMin; kkN <= kkMax; kkN++) {
          const kk = BigInt(kkN);
          const ak = kk * SCALE - gammaBig[k];
          // Solve [e_j; e_k] · p = (aj, ak). p is at scale SCALE.
          //   px = (eky·aj - ejy·ak) · SCALE / det
          //   py = (ejx·ak - ekx·aj) · SCALE / det
          const pxNum = (eky * aj - ejy * ak) * SCALE;
          const pyNum = (ejx * ak - ekx * aj) * SCALE;
          const px = bigintFloorDiv(pxNum, det);
          const py = bigintFloorDiv(pyNum, det);
          if (px < rectX0Big || px > rectX1Big || py < rectY0Big || py > rectY1Big) continue;
          const tup: bigint[] = new Array(5);
          for (let l = 0; l < 5; l++) {
            if (l === j) tup[l] = kj;
            else if (l === k) tup[l] = kk;
            else tup[l] = bigintFloorDiv(px * COS_HI[l] + py * SIN_HI[l] + gammaBig[l] * SCALE, SCALE2);
          }
          seen.add(`${tup[0]},${tup[1]},${tup[2]},${tup[3]},${tup[4]}`);
        }
      }
    }
  }
  return seen.size;
}

const { exact: gammaE, float: gammaF } = gammaFromSeed("funclol");

const TRY_SIZES = [
  { name: "small",   rect: { x0: -6, y0: -4, x1: 6, y1: 4 } },
  { name: "medium",  rect: { x0: -12, y0: -7, x1: 12, y1: 7 } },
  { name: "large",   rect: { x0: -18, y0: -11, x1: 18, y1: 11 } },
  { name: "x-large", rect: { x0: -24, y0: -15, x1: 24, y1: 15 } },
];

// Sanity: both implementations produce the same tile count for each rect.
for (const { name, rect } of TRY_SIZES) {
  const fc = enumerateTilesFloat(gammaF, rect);
  const ec = enumerateTilesExact(gammaE, rect);
  if (fc !== ec) {
    console.error(`${name}: float=${fc} exact=${ec} — disagreement (rect near origin should match)`);
  }
}

// Warm up
for (let i = 0; i < 3; i++) {
  enumerateTilesFloat(gammaF, TRY_SIZES[1].rect);
  enumerateTilesExact(gammaE, TRY_SIZES[1].rect);
}

console.log(`seed=funclol  oracle scale=10^50\n`);
console.log("size     rect      tiles   float64 mean   float64 p95   exact mean   exact p95   ratio");
console.log("-------  --------  ------  -------------  -----------   ----------   ---------   -----");

for (const { name, rect } of TRY_SIZES) {
  const N = 50;
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const fTimes: number[] = [];
  let count = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    count = enumerateTilesFloat(gammaF, rect);
    fTimes.push(performance.now() - t0);
  }
  fTimes.sort((a, b) => a - b);
  const fMean = fTimes.reduce((a, b) => a + b, 0) / N;
  const fP95 = fTimes[Math.floor(0.95 * N)];

  const eTimes: number[] = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    enumerateTilesExact(gammaE, rect);
    eTimes.push(performance.now() - t0);
  }
  eTimes.sort((a, b) => a - b);
  const eMean = eTimes.reduce((a, b) => a + b, 0) / N;
  const eP95 = eTimes[Math.floor(0.95 * N)];

  const ratio = eMean / fMean;
  console.log(
    `${name.padEnd(7)}  ${`${w}×${h}`.padEnd(8)}  ${String(count).padEnd(6)}  ${`${fMean.toFixed(2)}ms`.padEnd(13)}  ${`${fP95.toFixed(2)}ms`.padEnd(11)}   ${`${eMean.toFixed(2)}ms`.padEnd(10)}   ${`${eP95.toFixed(2)}ms`.padEnd(9)}   ${ratio.toFixed(1)}×`,
  );
}

console.log("");
console.log("verdict (vs 16ms/frame budget at 1500 tiles):");
console.log("  float64 — see table");
console.log("  exact   — see table");
