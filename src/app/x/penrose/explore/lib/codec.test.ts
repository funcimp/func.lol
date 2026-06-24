import { describe, expect, test } from "bun:test";

import { encodeTile, decodeTile, type TileAddress, parseSeed, parseZoom } from "./codec";

describe("tile codec round-trips the full [n; j, k] address", () => {
  const cases: TileAddress[] = [
    { coord: [0, 0, 0, 0, 0], j: 0, k: 1 },
    { coord: [3, -1, 0, 2, -4], j: 1, k: 4 },
    { coord: [10, 11, -12, 13, -14], j: 2, k: 3 },
    { coord: [-1, -1, -1, -1, -1], j: 3, k: 4 },
    { coord: [100000, -100000, 0, 7, -7], j: 0, k: 4 },
  ];
  for (const t of cases) {
    test(`round-trips ${encodeTile(t)}`, () => {
      expect(decodeTile(encodeTile(t))).toEqual(t);
    });
  }
});

describe("decodeTile rejects bad input", () => {
  const bad: (string | string[] | undefined)[] = [
    undefined,
    ["0.0.0.0.0.0.1"], // array, not a string
    "", // empty
    "0.0.0.0.0.0", // too few (6 parts)
    "0.0.0.0.0.0.1.2", // too many (8 parts)
    "1.2.3.4.5", // old 5-int form, too few
    "1.2.x.4.5.0.1", // non-integer coord
    "1.2.3.4.5.1.", // empty trailing part
    "1.2.3.4.5..1", // empty interior part
    "999999.0.0.0.0.0.1", // coord out of range (|n| > 100000)
    "0.0.0.0.0.2.1", // bad axes: j >= k
    "0.0.0.0.0.1.1", // bad axes: j == k
    "0.0.0.0.0.0.5", // bad axes: k > 4
    "0.0.0.0.0.-1.2", // bad axes: negative j
  ];
  for (const raw of bad) {
    test(`rejects ${JSON.stringify(raw)}`, () => {
      expect(decodeTile(raw)).toBeNull();
    });
  }
});

describe("parseSeed", () => {
  test("accepts a short alnum seed", () => {
    expect(parseSeed("funclol")).toBe("funclol");
    expect(parseSeed("a_b-9")).toBe("a_b-9");
  });
  test("rejects empty, array, too long, or illegal chars", () => {
    expect(parseSeed("")).toBeNull();
    expect(parseSeed(["x"])).toBeNull();
    expect(parseSeed("a".repeat(33))).toBeNull();
    expect(parseSeed("has space")).toBeNull();
  });
});

describe("parseZoom", () => {
  test("accepts and clamps", () => {
    expect(parseZoom("40")).toBe(40);
    expect(parseZoom("1")).toBe(4); // clamped up
    expect(parseZoom("9999")).toBe(800); // clamped down
  });
  test("rejects non-numbers", () => {
    expect(parseZoom("abc")).toBeNull();
    expect(parseZoom(undefined)).toBeNull();
    expect(parseZoom(["40"])).toBeNull();
  });
});
