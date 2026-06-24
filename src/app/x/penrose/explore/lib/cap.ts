// Cut-and-project Penrose engine (research prototype).
//
// A Penrose vertex is a point n ∈ ℤ⁵ whose internal projection lands in the
// acceptance window for its index. Physical position = projection to the plane.
// Window and inflation operator are the exact ones from Cotfas (math-ph/0403062,
// 0710.3845); see research/penrose/07-cut-and-project-window.md.

export const TAU = (1 + Math.sqrt(5)) / 2;

const L = [0, 1, 2, 3, 4] as const;
// ζ^l physical direction, ζ^{2l} internal direction
export const PCOS = L.map((l) => Math.cos((2 * Math.PI * l) / 5));
export const PSIN = L.map((l) => Math.sin((2 * Math.PI * l) / 5));
export const ICOS = L.map((l) => Math.cos((4 * Math.PI * l) / 5));
export const ISIN = L.map((l) => Math.sin((4 * Math.PI * l) / 5));

export type Vec5 = readonly [number, number, number, number, number];
export type Pt = readonly [number, number];

export function physical(n: Vec5): Pt {
  let x = 0, y = 0;
  for (let l = 0; l < 5; l++) { x += n[l] * PCOS[l]; y += n[l] * PSIN[l]; }
  return [x, y];
}
export function internal(n: Vec5): Pt {
  let x = 0, y = 0;
  for (let l = 0; l < 5; l++) { x += n[l] * ICOS[l]; y += n[l] * ISIN[l]; }
  return [x, y];
}
export function index(n: Vec5): number {
  return n[0] + n[1] + n[2] + n[3] + n[4];
}

// Membership in the unit regular pentagon P (circumradius 1, a vertex at angle 0).
const APOTHEM = Math.cos(Math.PI / 5);
const NORMALS = L.map((k) => [
  Math.cos(((36 + 72 * k) * Math.PI) / 180),
  Math.sin(((36 + 72 * k) * Math.PI) / 180),
] as const);
export function inPentagon(x: number, y: number, eps = 1e-9): boolean {
  for (const [dx, dy] of NORMALS) if (x * dx + y * dy > APOTHEM + eps) return false;
  return true;
}

// The four windows by index: K1 = v+P, K2 = v−τP, K3 = v+τP, K4 = v−P.
const SCALE_BY_INDEX = [0, 1, -TAU, TAU, -1];
export function inWindow(n: Vec5, vx = 0, vy = 0): boolean {
  const idx = index(n);
  if (idx < 1 || idx > 4) return false;
  const [ix, iy] = internal(n);
  const s = SCALE_BY_INDEX[idx];
  return inPentagon((ix - vx) / s, (iy - vy) / s);
}

export type Vertex = { n: Vec5; p: Pt };

// All tiling vertices whose physical position lies within `radius` of the origin.
export function generate(radius: number, vx = 0, vy = 0): Vertex[] {
  const N = Math.ceil(radius) + 2;
  const out: Vertex[] = [];
  const n = [0, 0, 0, 0, 0];
  for (n[0] = -N; n[0] <= N; n[0]++)
    for (n[1] = -N; n[1] <= N; n[1]++)
      for (n[2] = -N; n[2] <= N; n[2]++)
        for (n[3] = -N; n[3] <= N; n[3]++)
          for (n[4] = -N; n[4] <= N; n[4]++) {
            const v = n as unknown as Vec5;
            if (!inWindow(v, vx, vy)) continue;
            const p = physical(v);
            if (Math.hypot(p[0], p[1]) > radius) continue;
            out.push({ n: [n[0], n[1], n[2], n[3], n[4]], p });
          }
  return out;
}

// The φ-inflation: integer circulant A with first row (0,0,1,1,0).
const ROW0 = [0, 0, 1, 1, 0];
export function A(n: Vec5): Vec5 {
  const o = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) o[i] += ROW0[(j - i + 5) % 5] * n[j];
  return o as unknown as Vec5;
}

export const key = (n: Vec5): string => n.join(",");

// Unit-length edges (index pairs into `verts`).
export function unitEdges(verts: Vertex[]): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < verts.length; a++)
    for (let b = a + 1; b < verts.length; b++) {
      const d = Math.hypot(verts[b].p[0] - verts[a].p[0], verts[b].p[1] - verts[a].p[1]);
      if (Math.abs(d - 1) < 1e-6) out.push([a, b]);
    }
  return out;
}

// Rhombus faces, classified thick (edges 72° apart) / thin (144° apart). A rhombus
// has corners n, n+e_j, n+e_k, n+e_j+e_k for two families j<k (e_l = ℤ⁵ basis vec).
export function rhombi(verts: Vertex[]): { thick: number; thin: number } {
  const set = new Set(verts.map((v) => key(v.n)));
  const bump = (n: Vec5, l: number, d: number): Vec5 => {
    const c = [...n] as number[]; c[l] += d; return c as unknown as Vec5;
  };
  let thick = 0, thin = 0;
  for (const v of verts) {
    for (let j = 0; j < 5; j++)
      for (let k = j + 1; k < 5; k++) {
        const ej = bump(v.n, j, 1), ek = bump(v.n, k, 1), ejk = bump(ej, k, 1);
        if (set.has(key(ej)) && set.has(key(ek)) && set.has(key(ejk))) {
          const diff = k - j;
          if (diff === 1 || diff === 4) thick++;
          else thin++;
        }
      }
  }
  return { thick, thin };
}
