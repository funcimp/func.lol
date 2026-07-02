// Generate the committed geomWalls.json the geometry-only sketches render.
//
//   bun src/app/x/penrose/_components/lib/genGeomWalls.ts
//
// The sketches import this JSON so they do not recompute two large boards in the
// browser. The data is not trusted on its own: geomWall.test.ts re-runs
// computeGeomWalls() and asserts the committed JSON matches it byte-for-byte AND
// that every dead-end is a real geometric wall (the tempting move fits with zero
// overlap; after it every candidate on the next gap overlaps by real area).
// Regenerate this whenever the geometry parameters change, then run the test.
//
// Uses node:fs (not the Bun global) so it typechecks under the project's Node
// typings while still running under bun.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { computeGeomWalls } from "./geomWall";

const walls = computeGeomWalls();
const path = fileURLToPath(new URL("./geomWalls.json", import.meta.url));
writeFileSync(path, JSON.stringify(walls, null, 2) + "\n");

const a = walls.sceneA_rigidHexagon;
const b = walls.sceneB_thinRefuted;
console.log(
  `geomWalls.json written:\n` +
    `  A rigid hexagon: wall=${a.wall.length} completion=${a.uniqueCompletion.length} ` +
    `wrong=${a.wrongMove.type} c${a.wrongMove.corner} gaps=${a.unfillableGaps.length}\n` +
    `  B thin refuted:  wall=${b.wall.length} prefix=${b.forcedPrefix.length} ` +
    `tempting=${b.temptingThin.type} c${b.temptingThin.corner} gaps=${b.unfillableGaps.length}`,
);
