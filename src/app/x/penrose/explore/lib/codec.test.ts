import { describe, expect, test } from "bun:test";

import { encodeAddress, decodeAddress, parseSeed, parseZoom } from "./codec";

describe("address codec round-trips ℤ⁵ coordinates", () => {
  const cases: number[][] = [
    [0, 0, 0, 0, 0],
    [3, -1, 0, 2, -4],
    [10, 11, -12, 13, -14],
    [-1, -1, -1, -1, -1],
  ];
  for (const coord of cases) {
    test(`round-trips [${coord}]`, () => {
      expect(decodeAddress(encodeAddress(coord))).toEqual(coord);
    });
  }
});

describe("decodeAddress rejects bad input", () => {
  const bad: (string | string[] | undefined)[] = [
    undefined,
    ["3.0.0.0.0"],
    "",
    "1.2.3", // too few
    "1.2.3.4.5.6", // too many
    "1.2.x.4.5", // non-integer
    "1.2.3.4.5.5", // too many
    "1.2.3.4.999999", // component out of range (|n| > 100000)
  ];
  for (const raw of bad) {
    test(`rejects ${JSON.stringify(raw)}`, () => {
      expect(decodeAddress(raw)).toBeNull();
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
