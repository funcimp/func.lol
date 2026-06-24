// The closed-form inter-level coordinate recursion — the local, O(log) form of
// the substitution-address → de-Bruijn-coordinate map.
//
//     coord' = −A·coord + m·[1,1,1,1,1]
//
// Every term is forced by structure, none of it is fitted:
//   • −A is the inflation operator (eigenvalues −φ, 1/φ, 2).
//   • [1,1,1,1,1] is A's eigenvector for eigenvalue 2 AND the kernel of both
//     projections (π and π' send it to 0), so adding it shifts the de Bruijn index
//     by exactly 5 and moves the tile not at all. It is the unique index-gauge
//     direction — det A = 2 is why a single such digit suffices.
//   • m is the integer carry forced by requiring index(coord') = −2·index + 5m to
//     land in the valid 4-value band. In the canonical band {1,2,3,4} this is
//     m = ⌈(1 + 2·index)/5⌉ ∈ {1,2} (since −2 is invertible mod 5, index' = −2·index
//     mod 5 is always back in {1,2,3,4}).
//
// Iterating from a coarse seed reaches any depth in O(levels) exact-integer steps.

import { A, type Vec5 } from "./cap";

const apply = (coord: Vec5, m: number): Vec5 => {
  const a = A(coord);
  return [m - a[0], m - a[1], m - a[2], m - a[3], m - a[4]];
};

// Canonical frame: index ∈ {1,2,3,4}. The carry is fully determined by the index.
export function nextCoordCanonical(coord: Vec5): Vec5 {
  const index = coord[0] + coord[1] + coord[2] + coord[3] + coord[4];
  return apply(coord, Math.ceil((1 + 2 * index) / 5));
}

// Frame-relative: choose the carry so index' lands in the target level's band
// [bandMin, bandMin+3]. (bandMin = 1 in the canonical frame.)
export function nextCoord(coord: Vec5, targetBandMin: number): Vec5 {
  const index = coord[0] + coord[1] + coord[2] + coord[3] + coord[4];
  return apply(coord, Math.ceil((targetBandMin + 2 * index) / 5));
}
