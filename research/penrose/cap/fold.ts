// The closed-form inter-level coordinate recursion — the local, O(log) form of
// the substitution-address → de-Bruijn-coordinate map.
//
// A persistent vertex's coordinate at the next (finer) deflation level:
//
//     coord' = −A·coord + carry·[1,1,1,1,1]
//
// where carry = 1 iff the de Bruijn index Σcoord is in the upper half of its
// 4-value band. This is a base-(−A) numeration system on ℤ⁵ with a single binary
// digit (det A = 2), the digit being the index carry (A's index-direction
// eigenvalue is 2, hence the all-ones carry vector). Iterating from a coarse seed
// reaches any depth in O(levels) = O(log distance) integer steps — exact, no float.

import { A, type Vec5 } from "./cap";

export function nextCoord(coord: Vec5, bandMin: number): Vec5 {
  const idx = coord[0] + coord[1] + coord[2] + coord[3] + coord[4];
  const carry = idx >= bandMin + 2 ? 1 : 0;
  const a = A(coord);
  return [carry - a[0], carry - a[1], carry - a[2], carry - a[3], carry - a[4]];
}
