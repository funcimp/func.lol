// research/penrose/04-viewport-anchor.ts
//
// Q: Does the "BigInt truth, Float64 view" pattern preserve both 60fps
//    enumeration and exact addressing at any anchor magnitude?
//
// Pattern: state = (anchor: bigint × 2, offset: float × 2). For each
// direction j, precompute the anchor's projection once:
//
//   nProj_j = floor(anchor · e_j + γ_j)      // BigInt, exact
//   fProj_j = {anchor · e_j + γ_j} ∈ [0,1)   // Float64, fractional
//
// Per-frame enumeration runs in anchor-relative offset space with
// γ_eff = fProj. Found tiles get their absolute coord by adding nProj
// to each tuple element. The render path never touches the anchor.
//
// Two things to confirm:
//
// 1. **Correctness.** At anchor = (0,0), the anchored enumeration must
//    produce the same set of absolute coords as 03's BigInt-exact
//    enumeration on the same rect.
//
// 2. **Throughput.** Per-frame cost is independent of anchor magnitude
//    — the inner loop is identical Float64 math with substituted
//    constants. Time at anchors 0, 1e10, 1e20, 1e30, 1e40 and confirm
//    the times stay flat.
//
// Run: bun run research/penrose/04-viewport-anchor.ts

const SCALE = 10n ** 50n;
const SCALE_F = Number(SCALE);
const SCALE2 = SCALE * SCALE;

function bigintSqrt(n: bigint): bigint {
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

type Anchor = {
  x: bigint;
  y: bigint;
  nProj: readonly bigint[];
  fProj: readonly number[];
};

function makeAnchor(x: bigint, y: bigint, gammaBig: readonly bigint[]): Anchor {
  const nProj: bigint[] = new Array(5);
  const fProj: number[] = new Array(5);
  for (let j = 0; j < 5; j++) {
    // proj at scale SCALE²: x·COS_HI + y·SIN_HI + γ·SCALE
    const proj = x * COS_HI[j] + y * SIN_HI[j] + gammaBig[j] * SCALE;
    const n = bigintFloorDiv(proj, SCALE2);
    nProj[j] = n;
    // remainder ∈ [0, SCALE²)
    const remainder = proj - n * SCALE2;
    fProj[j] = Number(remainder) / Number(SCALE2);
  }
  return { x, y, nProj, fProj };
}

// Enumerate tiles in offset-relative rect. Returns the absolute coord set
// as strings "c0,c1,c2,c3,c4" (mix of bigint).
function enumerateAnchored(anchor: Anchor, rect: Rect): Set<string> {
  const seen = new Set<string>();
  const gamma = anchor.fProj;
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
          // Local offset coords (small numbers from Float64).
          const o0 = j === 0 ? kj : k === 0 ? kk : Math.floor(px * COS_F[0] + py * SIN_F[0] + gamma[0]);
          const o1 = j === 1 ? kj : k === 1 ? kk : Math.floor(px * COS_F[1] + py * SIN_F[1] + gamma[1]);
          const o2 = j === 2 ? kj : k === 2 ? kk : Math.floor(px * COS_F[2] + py * SIN_F[2] + gamma[2]);
          const o3 = j === 3 ? kj : k === 3 ? kk : Math.floor(px * COS_F[3] + py * SIN_F[3] + gamma[3]);
          const o4 = j === 4 ? kj : k === 4 ? kk : Math.floor(px * COS_F[4] + py * SIN_F[4] + gamma[4]);
          // Absolute coord = anchor.nProj + offset coord.
          const c0 = anchor.nProj[0] + BigInt(o0);
          const c1 = anchor.nProj[1] + BigInt(o1);
          const c2 = anchor.nProj[2] + BigInt(o2);
          const c3 = anchor.nProj[3] + BigInt(o3);
          const c4 = anchor.nProj[4] + BigInt(o4);
          seen.add(`${c0},${c1},${c2},${c3},${c4}`);
        }
      }
    }
  }
  return seen;
}

// Script 3's BigInt-exact enumerator, inlined for the correctness check.
function enumerateExact(gammaBig: readonly bigint[], rect: Rect): Set<string> {
  const seen = new Set<string>();
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
  return seen;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

const { exact: gammaE } = gammaFromSeed("funclol");
const rect: Rect = { x0: -12, y0: -7, x1: 12, y1: 7 };

// Correctness: anchor = (0, 0) should match script 3's exact enumeration.
const anchor0 = makeAnchor(0n, 0n, gammaE);
const anchoredSet = enumerateAnchored(anchor0, rect);
const exactSet = enumerateExact(gammaE, rect);
const correct = setsEqual(anchoredSet, exactSet);

console.log(`seed=funclol  rect=24×14 (1300+ tiles)\n`);
console.log(`correctness (anchor=0):  anchored=${anchoredSet.size}  exact=${exactSet.size}  equal=${correct}`);
if (!correct) {
  console.log(`  anchored extras: ${[...anchoredSet].filter((c) => !exactSet.has(c)).slice(0, 3).join("  |  ")}`);
  console.log(`  exact extras:    ${[...exactSet].filter((c) => !anchoredSet.has(c)).slice(0, 3).join("  |  ")}`);
}
console.log("");

// Throughput at different anchor magnitudes.
console.log("throughput vs anchor magnitude:");
console.log("anchor_mag    tiles   mean_ms   p95_ms");
console.log("------------  ------  --------  --------");

const ANCHOR_EXPS = [0, 5, 10, 20, 30, 40];
for (const exp of ANCHOR_EXPS) {
  const ax = exp === 0 ? 0n : (10n ** BigInt(exp)) * SCALE;
  const ay = exp === 0 ? 0n : (10n ** BigInt(exp)) * SCALE;
  const anchor = makeAnchor(ax, ay, gammaE);
  // Warmup
  for (let i = 0; i < 5; i++) enumerateAnchored(anchor, rect);
  const N = 50;
  const times: number[] = [];
  let count = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const tiles = enumerateAnchored(anchor, rect);
    count = tiles.size;
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / N;
  const p95 = times[Math.floor(0.95 * N)];
  const label = exp === 0 ? "0" : `1e${exp}`;
  console.log(
    `${label.padEnd(12)}  ${String(count).padEnd(6)}  ${`${mean.toFixed(2)}ms`.padEnd(8)}  ${p95.toFixed(2)}ms`,
  );
}

// makeAnchor cost (per anchor change, not per frame).
console.log("");
const N_ANCHOR = 10_000;
{
  const t0 = performance.now();
  for (let i = 0; i < N_ANCHOR; i++) makeAnchor((10n ** 20n) * SCALE, (10n ** 20n) * SCALE, gammaE);
  const dt = performance.now() - t0;
  console.log(`makeAnchor at |a|=1e20:  ${((dt / N_ANCHOR) * 1000).toFixed(2)} µs/call`);
}
