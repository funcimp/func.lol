import { describe, expect, test } from "bun:test";

import {
  decorationBreaks,
  decorationMap,
  decoratePatch,
  endPair,
  solveDecoration,
  type PolyTile,
} from "./decorate";
import type { SceneA, SceneB } from "./geomWall";
import walls from "./geomWalls.json";

const sceneA = walls.sceneA_rigidHexagon as unknown as SceneA;
const sceneB = walls.sceneB_thinRefuted as unknown as SceneB;

describe("scene A (sketch 04)", () => {
  const patch: PolyTile[] = [...sceneA.wall, ...sceneA.uniqueCompletion];

  test("the patch decoration is consistent and unique", () => {
    const a = solveDecoration(patch, 0);
    const b = solveDecoration(patch, 1);
    // a valid patch decorates from exactly one seed; the other contradicts
    expect([a, b].filter((x) => x !== null).length).toBe(1);
  });

  test("the tempting tile breaks the wall's arcs under BOTH of its markings", () => {
    // This is the license for sketch 04 to draw the violation: it is not a
    // choice of staging, no marking of the wrong move continues the arcs.
    const choices = decoratePatch(patch);
    // the wrong move lands before the completion exists, so test against the
    // wall's decoration only
    const wallDeco = decorationMap(sceneA.wall, choices.slice(0, sceneA.wall.length));
    const pair = endPair(sceneA.wrongMove);
    for (const m of pair) {
      const breaks = decorationBreaks(sceneA.wrongMove, m, wallDeco);
      expect(breaks.length).toBeGreaterThan(0);
    }
  });

  test("the unique completion continues the wall's arcs cleanly", () => {
    const choices = decoratePatch(patch);
    const wallDeco = decorationMap(sceneA.wall, choices.slice(0, sceneA.wall.length));
    sceneA.uniqueCompletion.forEach((t, k) => {
      const m = choices[sceneA.wall.length + k];
      expect(decorationBreaks(t, m, wallDeco).length).toBe(0);
    });
  });
});

describe("scene B (sketch 05)", () => {
  test("the patch decoration is consistent and unique", () => {
    const patch: PolyTile[] = [...sceneB.wall, ...sceneB.completion];
    const a = solveDecoration(patch, 0);
    const b = solveDecoration(patch, 1);
    expect([a, b].filter((x) => x !== null).length).toBe(1);
  });
});
