import { describe, expect, test } from "bun:test";

import {
  isAdmissibleConstellation,
  isPrime,
  primesUpTo,
} from "./primes";

describe("isPrime", () => {
  const primeCases: Array<[number, boolean]> = [
    [2, true],
    [3, true],
    [5, true],
    [7, true],
    [11, true],
    [29, true],
    [41, true],
    [43, true],
    [59, true],
    [61, true],
    [71, true],
    [73, true],
    [101, true],
    [103, true],
    [997, true],
  ];

  const compositeCases: Array<[number, boolean]> = [
    [0, false],
    [1, false],
    [4, false],
    [9, false],
    [15, false],
    [21, false],
    [25, false],
    [27, false],
    [49, false],
    [100, false],
    [121, false],
    [1000, false],
  ];

  const edgeCases: Array<[number, boolean]> = [
    [-1, false],
    [-2, false],
    [-7, false],
    [1.5, false],
    [Number.NaN, false],
  ];

  for (const [n, want] of [...primeCases, ...compositeCases, ...edgeCases]) {
    test(`isPrime(${n}) === ${want}`, () => {
      expect(isPrime(n)).toBe(want);
    });
  }
});

describe("primesUpTo", () => {
  const cases: Array<[number, number[]]> = [
    [-1, []],
    [0, []],
    [1, []],
    [2, [2]],
    [10, [2, 3, 5, 7]],
    [
      30,
      [2, 3, 5, 7, 11, 13, 17, 19, 23, 29],
    ],
  ];

  for (const [n, want] of cases) {
    test(`primesUpTo(${n})`, () => {
      expect(primesUpTo(n)).toEqual(want);
    });
  }
});

describe("isAdmissibleConstellation", () => {
  // Admissible patterns — can mathematically produce multiple all-prime
  // instances. Check the mod-q residues don't cover all of {0..q-1}.
  const admissibleCases: Array<[number[], string]> = [
    [[0], "singleton"],
    [[0, 10], "2-tuple with even gap"],
    [[0, 30, 32], "Toups Primes"],
    [[0, 6, 12], "[0, 6, 12]"],
    [[0, 6, 8], "[0, 6, 8]"],
    [[0, 2, 6, 8], "[0, 2, 6, 8]"],
    [[0, 12, 18, 30], "[0, 12, 18, 30]"],
  ];

  for (const [offsets, label] of admissibleCases) {
    test(`admissible: ${label} (${JSON.stringify(offsets)})`, () => {
      expect(isAdmissibleConstellation(offsets)).toBe(true);
    });
  }

  // Inadmissible patterns — provably at most one all-prime instance
  // (reachable only via the base-2 escape or similar singletons).
  const inadmissibleCases: Array<[number[], string]> = [
    [[0, 1], "[0, 1] — covers {0,1} mod 2"],
    [[0, 11], "[0, 11] — covers {0,1} mod 2, (2, 13) only"],
    [[0, 29, 32], "[0, 29, 32] — 29 is odd, parity mismatch"],
    [[0, 2, 4], "[0, 2, 4] — covers {0,1,2} mod 3, (3, 5, 7) only"],
    [
      [0, 6, 12, 18, 24],
      "[0, 6, 12, 18, 24] — covers {0..4} mod 5, (5,11,17,23,29) only",
    ],
  ];

  for (const [offsets, label] of inadmissibleCases) {
    test(`inadmissible: ${label}`, () => {
      expect(isAdmissibleConstellation(offsets)).toBe(false);
    });
  }
});
