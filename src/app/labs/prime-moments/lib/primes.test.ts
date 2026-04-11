import { describe, expect, test } from "bun:test";

import { isPrime, primesUpTo } from "./primes";

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
