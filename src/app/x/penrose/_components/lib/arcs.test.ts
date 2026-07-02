import { describe, expect, test } from "bun:test";

import {
  DOUBLE_FROM_HEAD,
  edgeCrossings,
  faceArcs,
  markedEnd,
  SINGLE_R,
} from "./arcs";
import { facesInViewport, GAMMA, type Rect } from "../../explore/lib/pentagrid";
import type { Pt } from "../../explore/lib/patch";

const view: Rect = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
const faces = facesInViewport(view, GAMMA);

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("the marked corner", () => {
  test("every face has exactly one corner of index 1 or 4, at the marked end", () => {
    for (const f of faces) {
      const s = f.coord.reduce((acc, x) => acc + x, 0);
      // corner indices around the cycle are s, s+1, s+2, s+1
      const indices = [s, s + 1, s + 2, s + 1];
      const extremes = indices.filter((i) => i === 1 || i === 4);
      expect(extremes.length).toBe(1);
      expect(indices[markedEnd(f)]).toBeOneOf([1, 4]);
    }
  });

  test("the marked corner is the sharp corner of the thick and the blunt corner of the thin", () => {
    // Grünbaum & Shephard mark the 72° corner of the thick rhombus and the
    // 144° corner of the thin one. The diagonal-end corners both carry that
    // angle, so checking the interior angle at the marked end checks the rule.
    for (const f of faces.slice(0, 200)) {
      const m = markedEnd(f);
      const at = f.corners[m];
      const [a, b] = [f.corners[1], f.corners[3]];
      const cosAngle =
        ((a[0] - at[0]) * (b[0] - at[0]) + (a[1] - at[1]) * (b[1] - at[1])) /
        (dist(a, at) * dist(b, at));
      const deg = (Math.acos(cosAngle) * 180) / Math.PI;
      expect(deg).toBeCloseTo(f.type === "thick" ? 72 : 144, 6);
    }
  });
});

describe("matching-rule continuity", () => {
  test("every shared edge gets the same arrow state and crossing point from both tiles", () => {
    const byEdge = new Map<string, { kind: string; point: Pt }[]>();
    for (const f of faces) {
      for (const c of edgeCrossings(f)) {
        const list = byEdge.get(c.edgeKey) ?? [];
        list.push({ kind: c.kind, point: c.point });
        byEdge.set(c.edgeKey, list);
      }
    }
    let shared = 0;
    for (const list of byEdge.values()) {
      // halo edges at the patch border are seen once; interior edges twice
      expect(list.length).toBeLessThanOrEqual(2);
      if (list.length !== 2) continue;
      shared++;
      expect(list[0].kind).toBe(list[1].kind);
      expect(dist(list[0].point, list[1].point)).toBeLessThan(1e-9);
    }
    // a radius-10 patch has hundreds of interior edges; the property must be
    // exercised at scale, not on a handful
    expect(shared).toBeGreaterThan(500);
  });
});

describe("arc geometry", () => {
  test("arcs are centred on opposite corners with the documented radii, endpoints on the edges", () => {
    for (const f of faces.slice(0, 200)) {
      const [single, double] = faceArcs(f);
      expect(single.radius).toBe(SINGLE_R);
      expect(double.radius).toBeCloseTo(
        f.type === "thick" ? 1 - DOUBLE_FROM_HEAD : DOUBLE_FROM_HEAD,
        12,
      );
      for (const arc of [single, double]) {
        expect(dist(arc.center, arc.start)).toBeCloseTo(arc.radius, 9);
        expect(dist(arc.center, arc.end)).toBeCloseTo(arc.radius, 9);
      }
      // the two arcs sit on opposite corners (the diagonal ends)
      const m = markedEnd(f);
      expect(dist(single.center, f.corners[m])).toBe(0);
      expect(dist(double.center, f.corners[m === 0 ? 2 : 0])).toBe(0);
    }
  });
});
