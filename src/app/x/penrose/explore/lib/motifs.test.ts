import { describe, expect, test } from "bun:test";

import { facesInViewport, GAMMA, type Rect } from "./pentagrid";
import { suns } from "./motifs";

// BIND the rosette glow to the engine. The early "patterns" sketch glows the suns
// (five thick rhombi meeting at a vertex). This checks they are real: a patch contains
// several, and each is a genuine vertex with exactly five incident tiles, all thick.

const view: Rect = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
const faces = facesInViewport(view, GAMMA);

describe("suns are real five-thick-rhombi vertices", () => {
  const found = suns(faces);

  test("a patch contains several suns", () => {
    expect(found.length).toBeGreaterThan(5);
  });

  test("each reported sun has exactly five incident tiles, all thick", () => {
    const vkey = (p: readonly [number, number]) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
    const inc = new Map<string, { thick: number; total: number }>();
    for (const f of faces) {
      for (const c of f.corners) {
        const k = vkey(c);
        const e = inc.get(k) ?? { thick: 0, total: 0 };
        e.total++;
        if (f.type === "thick") e.thick++;
        inc.set(k, e);
      }
    }
    for (const s of found) {
      const e = inc.get(vkey(s));
      expect(e).toBeDefined();
      expect(e!.total).toBe(5);
      expect(e!.thick).toBe(5);
    }
  });
});
