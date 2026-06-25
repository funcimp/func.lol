// Authored geometry for the two Penrose rhombi, used by the "Meet the two tiles"
// sketch. Both tiles share a unit edge. The numbers here are the teaching point:
// with a unit edge, the thick rhombus's long diagonal is exactly the golden ratio
// and the thin rhombus's short diagonal is exactly 1/phi. That is where phi hides.

export const PHI = (1 + Math.sqrt(5)) / 2;

export type Pt = readonly [number, number];

export type RhombusKind = "thick" | "thin";

// A rhombus centred on the origin, unit edge, with its acute vertices on the
// horizontal axis. acute is the small interior angle in degrees; obtuse is its
// supplement. corners run counter-clockwise from the right (acute) vertex.
export type Rhombus = {
  kind: RhombusKind;
  acute: number; // degrees
  obtuse: number; // degrees
  corners: readonly [Pt, Pt, Pt, Pt];
  longDiagonal: number; // tip-to-tip across the obtuse corners
  shortDiagonal: number; // tip-to-tip across the acute corners
};

const deg = (d: number) => (d * Math.PI) / 180;

// Build a unit-edge rhombus from its acute interior angle. The acute corners sit
// on the x-axis, the obtuse corners on the y-axis, so the long diagonal is
// horizontal and the short diagonal vertical. Half-diagonals come straight from
// the half-angles: cos(acute/2) and sin(acute/2).
function rhombus(kind: RhombusKind, acute: number): Rhombus {
  const half = deg(acute / 2);
  const hx = Math.cos(half); // half the long diagonal
  const hy = Math.sin(half); // half the short diagonal
  const corners: readonly [Pt, Pt, Pt, Pt] = [
    [hx, 0], // right, acute
    [0, hy], // top, obtuse
    [-hx, 0], // left, acute
    [0, -hy], // bottom, obtuse
  ];
  return {
    kind,
    acute,
    obtuse: 180 - acute,
    corners,
    longDiagonal: 2 * hx,
    shortDiagonal: 2 * hy,
  };
}

// The thick (fat) rhombus: interior angles 72 and 108. Its long diagonal is phi.
export const THICK: Rhombus = rhombus("thick", 72);

// The thin (skinny) rhombus: interior angles 36 and 144. Its short diagonal is 1/phi.
export const THIN: Rhombus = rhombus("thin", 36);

// A unit-edge rhombus placed in the plane by seating one of its corners at an apex
// vertex. The corner's interior angle is `cornerAngle` (one of 36/72/108/144) and
// its two unit edges open from `startAngle`, counter-clockwise, spanning the wedge
// [startAngle, startAngle + cornerAngle]. Corners run apex -> first edge tip -> far
// corner -> second edge tip, so adjacent fan tiles that abut at startAngle share an
// edge exactly. This is the building block of the "dead-end" fan: tiles laid one at
// a time around a shared vertex, each abutting the last. Angles are degrees.
export function fanTile(cornerAngle: number, startAngle: number, apex: Pt = [0, 0]): readonly [Pt, Pt, Pt, Pt] {
  const a = deg(cornerAngle);
  const s = deg(startAngle);
  const e1: Pt = [apex[0] + Math.cos(s), apex[1] + Math.sin(s)];
  const e2: Pt = [apex[0] + Math.cos(s + a), apex[1] + Math.sin(s + a)];
  // Far corner closes the rhombus: apex + both edge vectors (the parallelogram law).
  const far: Pt = [e1[0] + e2[0] - apex[0], e1[1] + e2[1] - apex[1]];
  return [apex, e1, far, e2];
}
