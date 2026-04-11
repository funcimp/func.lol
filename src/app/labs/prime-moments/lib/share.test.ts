import { describe, expect, test } from "bun:test";

import { encodeShareParam, parseShareParam } from "./share";

describe("encodeShareParam", () => {
  test("comma-joins offsets", () => {
    expect(encodeShareParam([0, 30, 32])).toBe("0,30,32");
  });
  test("handles single-element", () => {
    expect(encodeShareParam([0])).toBe("0");
  });
  test("handles larger constellations", () => {
    expect(encodeShareParam([0, 6, 12, 18, 24])).toBe("0,6,12,18,24");
  });
});

describe("parseShareParam — valid inputs", () => {
  const cases: Array<[string, number[]]> = [
    ["0,30,32", [0, 30, 32]],
    ["0", [0]],
    ["0,6,12,18,24", [0, 6, 12, 18, 24]],
    ["0, 30, 32", [0, 30, 32]], // whitespace tolerated
    ["0,30,32;0,6", [0, 30, 32]], // multi-constellation — first only
  ];
  for (const [input, expected] of cases) {
    test(`accepts ${JSON.stringify(input)}`, () => {
      expect(parseShareParam(input)).toEqual(expected);
    });
  }
});

describe("parseShareParam — invalid inputs", () => {
  const cases: Array<[string | string[] | undefined, string]> = [
    [undefined, "undefined"],
    [["a", "b"], "array value"],
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["not,numbers", "non-numeric parts"],
    ["1,30,32", "doesn't start with 0"],
    ["0,30,30", "not strictly ascending (duplicate)"],
    ["0,30,20", "descending"],
    ["0,-5", "negative value"],
    ["0,200", "over maxLifespan"],
    ["0,3.5", "non-integer"],
  ];
  for (const [input, label] of cases) {
    test(`rejects ${label}`, () => {
      expect(parseShareParam(input)).toBeNull();
    });
  }
});

describe("parseShareParam round-trip", () => {
  test("encode → parse recovers the original offsets", () => {
    const offsets = [0, 30, 32];
    expect(parseShareParam(encodeShareParam(offsets))).toEqual(offsets);
  });
  test("single-element round-trip", () => {
    expect(parseShareParam(encodeShareParam([0]))).toEqual([0]);
  });
});
