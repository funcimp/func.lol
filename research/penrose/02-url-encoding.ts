// research/penrose/02-url-encoding.ts
//
// Q: For typical (cx, cy, zoom, level) viewport states, how long is the
//    URL share-link under different encodings?
//
// Precision choices (justified separately): cx, cy in world units to
// 1e-3 (sub-pixel at every plausible zoom); zoom to 1e-2; level int.
// At 1e-3 precision, cx, cy as ints fit in int32 across |p| ≤ 2e6.
//
// Encodings:
//   base62  prime-moments pattern: 4 nonneg ints (signed via +2^31
//           offset), each base62-encoded, joined with '.'.
//   b64url  same 4 ints packed little-endian into a 16-byte buffer,
//           base64url-encoded.
//   hex     same 4 ints in hex, joined with '.'.
//   json    encodeURIComponent(JSON.stringify({...})).
//
// 1000 random states sampled from the explorer's plausible reach:
//   cx, cy ~ uniform in [-1e6, 1e6]
//   zoom   ~ log-uniform in [1, 1000]
//   level  ~ uniform int in [-2, 3]
//
// Run: bun run research/penrose/02-url-encoding.ts

const B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toBase62(n: number): string {
  if (n === 0) return "0";
  const neg = n < 0;
  let x = Math.abs(Math.trunc(n));
  let s = "";
  while (x > 0) {
    s = B62[x % 62] + s;
    x = Math.floor(x / 62);
  }
  return neg ? "-" + s : s;
}

const OFFSET = 2 ** 31;

function asFixedInts(cx: number, cy: number, zoom: number, level: number) {
  return {
    cxI: Math.round(cx * 1e3) + OFFSET,
    cyI: Math.round(cy * 1e3) + OFFSET,
    zI: Math.round(zoom * 1e2),
    lI: level + 10,
  };
}

function encodeBase62(cx: number, cy: number, zoom: number, level: number): string {
  const { cxI, cyI, zI, lI } = asFixedInts(cx, cy, zoom, level);
  return `${toBase62(cxI)}.${toBase62(cyI)}.${toBase62(zI)}.${toBase62(lI)}`;
}

function encodeBase64url(cx: number, cy: number, zoom: number, level: number): string {
  const { cxI, cyI, zI, lI } = asFixedInts(cx, cy, zoom, level);
  const buf = Buffer.alloc(16);
  buf.writeUInt32LE(cxI, 0);
  buf.writeUInt32LE(cyI, 4);
  buf.writeUInt32LE(zI, 8);
  buf.writeUInt32LE(lI, 12);
  return buf.toString("base64url");
}

function encodeHex(cx: number, cy: number, zoom: number, level: number): string {
  const { cxI, cyI, zI, lI } = asFixedInts(cx, cy, zoom, level);
  return `${cxI.toString(16)}.${cyI.toString(16)}.${zI.toString(16)}.${lI.toString(16)}`;
}

function encodeJson(cx: number, cy: number, zoom: number, level: number): string {
  return encodeURIComponent(
    JSON.stringify({
      cx: +cx.toFixed(3),
      cy: +cy.toFixed(3),
      z: +zoom.toFixed(2),
      l: level,
    }),
  );
}

const ENCODINGS: Record<string, (cx: number, cy: number, z: number, l: number) => string> = {
  base62: encodeBase62,
  b64url: encodeBase64url,
  hex: encodeHex,
  json: encodeJson,
};

const N = 1000;
const lens: Record<string, number[]> = { base62: [], b64url: [], hex: [], json: [] };

for (let i = 0; i < N; i++) {
  const cx = (Math.random() * 2 - 1) * 1e6;
  const cy = (Math.random() * 2 - 1) * 1e6;
  const zoom = Math.exp(Math.random() * Math.log(1000));
  const level = Math.floor(Math.random() * 6) - 2;
  for (const [k, fn] of Object.entries(ENCODINGS)) {
    lens[k].push(fn(cx, cy, zoom, level).length);
  }
}

function summarize(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const p95 = sorted[Math.floor(0.95 * sorted.length)];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  return { min, mean, p95, max };
}

console.log(`samples=${N}  cx,cy∈[-1e6,1e6]  zoom∈[1,1000]  level∈[-2,3]\n`);
console.log("encoding  min   mean   p95   max   example");
console.log("--------  ----  ----   ----  ----  --------");
const example = { cx: 12.3456, cy: -789.0123, zoom: 42.5, level: 1 };
for (const k of Object.keys(ENCODINGS)) {
  const s = summarize(lens[k]);
  const ex = ENCODINGS[k](example.cx, example.cy, example.zoom, example.level);
  console.log(
    `${k.padEnd(8)}  ${String(s.min).padEnd(4)}  ${s.mean.toFixed(1).padEnd(5)}  ${String(s.p95).padEnd(4)}  ${String(s.max).padEnd(4)}  ${ex}`,
  );
}

// The base62 entry is the prime-moments precedent. Decision criterion:
// keep base62 unless something is >10% shorter at p95.
const b62 = summarize(lens.base62);
const winners = Object.entries(lens)
  .map(([k, xs]) => ({ k, s: summarize(xs) }))
  .filter((e) => e.k !== "base62" && e.s.p95 < b62.p95 * 0.9);
const summary = winners.length === 0
  ? `base62 is within 10% of every alternative at p95 — keep the prime-moments codec`
  : `${winners.map((w) => w.k).join(", ")} beats base62 by >10% at p95`;
console.log(`\nsummary: ${summary}`);
