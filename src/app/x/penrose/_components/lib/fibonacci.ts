// The 2D -> 1D cut-and-project: the visible, honest miniature of the 5D -> 2D
// construction the explorer runs. A line through the integer lattice Z^2 at the
// golden slope, and a strip (the "window") around it. Lattice points that fall in
// the strip project onto the line and produce the Fibonacci chain: long and short
// intervals whose lengths are in ratio phi and whose order never repeats.
//
//   physical(p) = p . D       position along the line (the kept shadow)
//   internal(p) = p . DPERP   distance off the line (the shadow that must land
//                             in the window)
//   accept(p)   iff internal(p) in [gamma, gamma + WINDOW_W)
//
// The window width is exactly the unit cell projected onto the internal axis, the
// 2D image of "the projection of the unit hypercube" that defines the Penrose
// window. With that width, consecutive accepted points along the line differ by a
// single unit lattice step, (1,0) or (0,1), which project to the two physical
// lengths LONG = phi/NORM and SHORT = 1/NORM, ratio phi. fibonacci.test.ts binds
// the code to that claim: two gap lengths, ratio phi, unit steps only, no SS, and
// a thick:thin count tending to phi.

export const PHI = (1 + Math.sqrt(5)) / 2;
const NORM = Math.sqrt(PHI * PHI + 1);

// Physical direction: the line of slope 1/phi. Internal direction: its perpendicular.
export const D: readonly [number, number] = [PHI / NORM, 1 / NORM];
export const DPERP: readonly [number, number] = [-1 / NORM, PHI / NORM];

// The window is the unit cell projected onto the internal axis. Width phi^2 / NORM
// (phi + 1 = phi^2).
export const WINDOW_W = (PHI + 1) / NORM;

export const LONG = PHI / NORM; // physical length of a (1,0) step
export const SHORT = 1 / NORM; // physical length of a (0,1) step

export type LatPt = {
  m: number;
  n: number;
  phys: number; // along the line
  internal: number; // off the line (the shadow tested against the window)
  accepted: boolean;
};

export function physical(m: number, n: number): number {
  return (PHI * m + n) / NORM;
}

export function internal(m: number, n: number): number {
  return (-m + PHI * n) / NORM;
}

// Every lattice point with |m|,|n| <= range, each tagged accepted against the
// strip [gamma, gamma + WINDOW_W).
export function latticePoints(range: number, gamma: number): LatPt[] {
  const out: LatPt[] = [];
  for (let m = -range; m <= range; m++) {
    for (let n = -range; n <= range; n++) {
      const off = internal(m, n);
      out.push({
        m,
        n,
        phys: physical(m, n),
        internal: off,
        accepted: off >= gamma && off < gamma + WINDOW_W,
      });
    }
  }
  return out;
}

export type ChainSeg = {
  from: LatPt;
  to: LatPt;
  kind: "L" | "S";
};

// The 1D chain: accepted points sorted along the line, each gap classified long or
// short by which unit step bridges it.
export function chain(
  range: number,
  gamma: number,
): { points: LatPt[]; segs: ChainSeg[] } {
  const points = latticePoints(range, gamma)
    .filter((p) => p.accepted)
    .sort((a, b) => a.phys - b.phys);
  const mid = (LONG + SHORT) / 2;
  const segs: ChainSeg[] = [];
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].phys - points[i - 1].phys;
    segs.push({
      from: points[i - 1],
      to: points[i],
      kind: gap > mid ? "L" : "S",
    });
  }
  return { points, segs };
}
