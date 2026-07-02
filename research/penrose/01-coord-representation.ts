// research/penrose/01-coord-representation.ts
//
// Q: Where does Float64 disagree with a high-precision oracle for the
//    pentagrid pointToCoord operation, and what does the oracle cost?
//
// Method: implement pointToCoord twice.
//
//   Exact   — BigInt arithmetic. Constants computed algebraically from
//             √5 via BigInt sqrt, scaled to ~50 decimal digits. The
//             scale is large enough that floor() of the projection is
//             provably correct for any magnitude tested below.
//
//   Float64 — straight Float64. The candidate cheap implementation.
//
// At each magnitude R, sample N random points (generated as BigInt so
// both implementations see the same intended position; Float64 receives
// the Float64-cast version). Compare the two 5-tuples coord-by-coord.
//
// First disagreement = the precision-drift boundary. Throughput numbers
// at the bottom price the difference.
//
// Decision input: ship `Coord = readonly [bigint, ...]` with exact math
// for correctness at any size. Use Float64 only as a per-frame optimization
// if the perf budget forces a viewport-anchor compromise.
//
// Run: bun run research/penrose/01-coord-representation.ts

const SCALE = 10n ** 50n;
const SCALE_F = Number(SCALE);

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
  if (d <= 0n) throw new Error("d must be positive");
  if (n >= 0n) return n / d;
  const q = n / d;
  return n % d === 0n ? q : q - 1n;
}

// Algebraic constants at scale SCALE.
//   cos(2π/5) = (√5 - 1) / 4
//   cos(4π/5) = -(√5 + 1) / 4
//   sin(2π/5) = √(10 + 2√5) / 4
//   sin(4π/5) = √(10 - 2√5) / 4
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

// pointToCoord — exact. pxBig, pyBig at scale SCALE (i.e., the real
// coordinate × SCALE). gammaBig at scale SCALE.
function pointToCoordExact(pxBig: bigint, pyBig: bigint, gammaBig: readonly bigint[]): readonly bigint[] {
  const SCALE2 = SCALE * SCALE;
  const out: bigint[] = new Array(5);
  for (let j = 0; j < 5; j++) {
    const proj = pxBig * COS_HI[j] + pyBig * SIN_HI[j] + gammaBig[j] * SCALE;
    out[j] = bigintFloorDiv(proj, SCALE2);
  }
  return out;
}

// pointToCoord — Float64.
function pointToCoordFloat(px: number, py: number, gamma: readonly number[]): readonly number[] {
  const out: number[] = new Array(5);
  for (let j = 0; j < 5; j++) {
    out[j] = Math.floor(px * COS_F[j] + py * SIN_F[j] + gamma[j]);
  }
  return out;
}

// gamma: derive BigInt natively from a deterministic hash, then cast to
// Float64. Both implementations get equivalent inputs; only Float64's
// computation has precision loss.
function gammaFromSeed(seed: string): { exact: readonly bigint[]; float: readonly number[] } {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const raw: bigint[] = [];
  for (let i = 0; i < 5; i++) {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0;
    // h is in [0, 2^32). Map to [-SCALE/2, SCALE/2).
    raw.push((BigInt(h) * SCALE) / (1n << 32n) - SCALE / 2n);
  }
  const sum = raw.reduce((a, b) => a + b, 0n);
  const exact = raw.map((g) => g - sum / 5n);
  const float = exact.map((g) => Number(g) / SCALE_F);
  return { exact, float };
}

// Random point at magnitude approximately magBig.
function randomPoint(magBig: bigint): { pxBig: bigint; pyBig: bigint; pxF: number; pyF: number } {
  const theta = Math.random() * 2 * Math.PI;
  const DIR_SCALE = 10n ** 15n;
  const dirCos = BigInt(Math.round(Math.cos(theta) * 1e15));
  const dirSin = BigInt(Math.round(Math.sin(theta) * 1e15));
  // px = magBig · dirCos · SCALE / DIR_SCALE.
  const pxBig = (magBig * dirCos * SCALE) / DIR_SCALE;
  const pyBig = (magBig * dirSin * SCALE) / DIR_SCALE;
  const pxF = Number(pxBig) / SCALE_F;
  const pyF = Number(pyBig) / SCALE_F;
  return { pxBig, pyBig, pxF, pyF };
}

const seed = "funclol";
const { exact: gammaE, float: gammaF } = gammaFromSeed(seed);

const MAGNITUDES: { label: string; mag: bigint }[] = [
  { label: "0", mag: 0n },
  { label: "1e+3", mag: 10n ** 3n },
  { label: "1e+6", mag: 10n ** 6n },
  { label: "1e+9", mag: 10n ** 9n },
  { label: "1e+12", mag: 10n ** 12n },
  { label: "1e+13", mag: 10n ** 13n },
  { label: "1e+14", mag: 10n ** 14n },
  { label: "1e+15", mag: 10n ** 15n },
  { label: "1e+18", mag: 10n ** 18n },
  { label: "1e+24", mag: 10n ** 24n },
  { label: "1e+30", mag: 10n ** 30n },
  { label: "1e+40", mag: 10n ** 40n },
];

const SAMPLES = 1000;

console.log(`seed=${seed}  samples=${SAMPLES}  oracle scale=10^50\n`);
console.log("|p|       agree     disagree  first disagreement");
console.log("--------  --------  --------  ------------------");

const disagreements: { mag: string; rate: number }[] = [];
for (const { label, mag } of MAGNITUDES) {
  let agree = 0;
  let disagree = 0;
  let example = "";
  for (let i = 0; i < SAMPLES; i++) {
    const { pxBig, pyBig, pxF, pyF } = randomPoint(mag);
    const coordE = pointToCoordExact(pxBig, pyBig, gammaE);
    const coordF = pointToCoordFloat(pxF, pyF, gammaF);
    let same = true;
    for (let j = 0; j < 5; j++) {
      const f = coordF[j];
      if (!Number.isFinite(f) || Math.abs(f) > Number.MAX_SAFE_INTEGER || BigInt(f) !== coordE[j]) {
        same = false;
        break;
      }
    }
    if (same) agree++;
    else {
      disagree++;
      if (example === "") {
        example = `exact=[${coordE.join(",")}]  float=[${coordF.join(",")}]`;
      }
    }
  }
  const rate = disagree / SAMPLES;
  disagreements.push({ mag: label, rate });
  const ag = `${((agree / SAMPLES) * 100).toFixed(1)}%`.padEnd(8);
  const dis = `${(rate * 100).toFixed(1)}%`.padEnd(8);
  console.log(`${label.padEnd(8)}  ${ag}  ${dis}  ${example.slice(0, 70)}`);
}

const firstBad = disagreements.find((d) => d.rate > 0);
console.log("");
console.log(
  firstBad
    ? `first disagreement at |p|=${firstBad.mag} (rate ${(firstBad.rate * 100).toFixed(1)}%)`
    : "no disagreement across tested range",
);

// Throughput.
console.log("");
const BENCH_N = 50_000;
const bp = randomPoint(10n ** 6n);
{
  const t0 = performance.now();
  for (let i = 0; i < BENCH_N; i++) pointToCoordExact(bp.pxBig, bp.pyBig, gammaE);
  const dt = performance.now() - t0;
  console.log(`exact:    ${((dt / BENCH_N) * 1000).toFixed(2)} µs/call  (${BENCH_N} calls in ${dt.toFixed(0)} ms)`);
}
{
  const t0 = performance.now();
  for (let i = 0; i < BENCH_N; i++) pointToCoordFloat(bp.pxF, bp.pyF, gammaF);
  const dt = performance.now() - t0;
  console.log(`float64:  ${((dt / BENCH_N) * 1000).toFixed(2)} µs/call  (${BENCH_N} calls in ${dt.toFixed(0)} ms)`);
}
