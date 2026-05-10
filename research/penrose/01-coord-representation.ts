// research/penrose/01-coord-representation.ts
//
// Q: At what world-position magnitude does Float64 lose enough precision
//    that pointToCoord stops behaving locally smoothly?
//
// Method: at magnitude R, sample N points at random angles. For each
//   point p_a, compute p_b = p_a + δ·(cos θ, sin θ) with δ = 1e-3 (a
//   small sub-tile step). Compare coord(p_a) and coord(p_b). Each
//   sample is categorized:
//
//     quantized — p_b == p_a at the Float64 level (Δp got rounded to 0)
//     stable    — coords equal
//     adjacent  — coords differ by at most 1 in every index (expected
//                 near a tile boundary; happens at any R)
//     jump      — coords differ by >1 in some index (Float64 lost
//                 enough bits that p·e_j is computed inconsistently
//                 between p_a and p_b)
//
//   "jump" is the failure signal. At low R it should be 0%. The first
//   R where it appears is the practical Float64 ceiling for the
//   shipped Coord type.
//
// Decision input: ship `Coord = readonly [number, number, number, number, number]`
//   if jump rate stays at 0% across the explorer's reachable range
//   (estimated below). Switch to bigint elements + Float64 viewport-anchor
//   pattern otherwise.
//
// Run: bun run research/penrose/01-coord-representation.ts

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

type Coord = readonly [number, number, number, number, number];

function pointToCoord(p: readonly [number, number], gamma: readonly number[]): Coord {
  const c = [0, 0, 0, 0, 0];
  for (let j = 0; j < 5; j++) {
    c[j] = Math.floor(p[0] * E[j][0] + p[1] * E[j][1] + gamma[j]);
  }
  return c as unknown as Coord;
}

function classify(a: Coord, b: Coord): "stable" | "adjacent" | "jump" {
  let maxDelta = 0;
  for (let i = 0; i < 5; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > maxDelta) maxDelta = d;
  }
  if (maxDelta === 0) return "stable";
  if (maxDelta === 1) return "adjacent";
  return "jump";
}

const DELTA = 1e-3;
const SAMPLES = 10_000;
const MAGNITUDES = [0, 1e2, 1e4, 1e6, 1e8, 1e9, 1e10, 1e11, 1e12, 1e14, 1e16];

const gamma = gammaFromSeed("funclol");

type Row = { mag: number; quantized: number; stable: number; adjacent: number; jump: number };
const rows: Row[] = [];

for (const mag of MAGNITUDES) {
  const counts = { quantized: 0, stable: 0, adjacent: 0, jump: 0 };
  for (let i = 0; i < SAMPLES; i++) {
    const phi = Math.random() * 2 * Math.PI;
    const px = mag * Math.cos(phi);
    const py = mag * Math.sin(phi);
    const theta = Math.random() * 2 * Math.PI;
    const pxB = px + DELTA * Math.cos(theta);
    const pyB = py + DELTA * Math.sin(theta);
    if (pxB === px && pyB === py) {
      counts.quantized++;
      continue;
    }
    const ca = pointToCoord([px, py], gamma);
    const cb = pointToCoord([pxB, pyB], gamma);
    counts[classify(ca, cb)]++;
  }
  rows.push({ mag, ...counts });
}

console.log(`seed=funclol  samples=${SAMPLES}  δ=${DELTA}\n`);
console.log("|p|       quantized  stable  adjacent  jump");
console.log("--------  ---------  ------  --------  ----");
for (const r of rows) {
  const tag = (r.mag === 0 ? "0" : r.mag.toExponential(0)).padEnd(8);
  const q = `${((r.quantized / SAMPLES) * 100).toFixed(1)}%`.padEnd(9);
  const s = `${((r.stable / SAMPLES) * 100).toFixed(1)}%`.padEnd(6);
  const a = `${((r.adjacent / SAMPLES) * 100).toFixed(1)}%`.padEnd(8);
  const j = `${((r.jump / SAMPLES) * 100).toFixed(2)}%`;
  console.log(`${tag}  ${q}  ${s}  ${a}  ${j}`);
}

const firstJump = rows.find((r) => r.jump > 0);
const firstQuantized = rows.find((r) => r.quantized > 0);
console.log("");
console.log(
  `first jump:      ${firstJump ? `|p|=${firstJump.mag.toExponential(0)} (${firstJump.jump}/${SAMPLES})` : "none in tested range"}`,
);
console.log(
  `first quantized: ${firstQuantized ? `|p|=${firstQuantized.mag.toExponential(0)} (${firstQuantized.quantized}/${SAMPLES})` : "none in tested range"}`,
);

// Reach estimate. At zoom z in a 1500px viewport, one screen-width per
// second of panning moves world by 1500/z units/sec. Plausible upper
// bound for one user session:
//   z=1     1500 u/s × 3600 s/hr  = 5.4e6 per hour
//   z=10    150 u/s × 3600 s/hr   = 5.4e5 per hour
//   z=1000  1.5 u/s × 3600 s/hr   = 5.4e3 per hour
console.log("");
console.log("reach estimate (one continuous hour of panning):");
console.log("  zoom=1     →  |p| ≈ 5e6");
console.log("  zoom=10    →  |p| ≈ 5e5");
console.log("  zoom=1000  →  |p| ≈ 5e3");
