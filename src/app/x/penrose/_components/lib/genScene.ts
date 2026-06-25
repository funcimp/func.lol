// Generate the committed scene.json the section-5 sketch renders.
//
//   bun src/app/x/penrose/_components/lib/genScene.ts
//
// The sketch imports this JSON so it does not recompute a 410-tile board in the
// browser. The data is not trusted on its own: unsolvableFuture.test.ts re-runs
// computeScene() and asserts the committed JSON matches it byte-for-byte AND that
// every dead-end is genuinely doomed. Regenerate this whenever the proof
// parameters change, then run the test.
//
// Uses node:fs (not the Bun global) so it typechecks under the project's Node
// typings while still running under bun.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { computeScene } from "./unsolvableFuture";

const scene = computeScene();
const path = fileURLToPath(new URL("./scene.json", import.meta.url));
writeFileSync(path, JSON.stringify(scene, null, 2) + "\n");
console.log(
  `scene.json written: wall=${scene.meta.wallTiles} hole=${scene.meta.holeEdges} ` +
    `completion=${scene.meta.completionTiles} deadEnds=${scene.meta.deadEnds}`,
);
