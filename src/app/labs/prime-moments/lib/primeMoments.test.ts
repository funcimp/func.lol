import { describe, expect, test } from "bun:test";

import { findPrimeMoments } from "./primeMoments";
import type { FamilyMember } from "./types";

// Helpers ----------------------------------------------------------------

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

const TOUPS_FAMILY: FamilyMember[] = [
  { id: "lyra", name: "Lyra", birthDate: "2014-09-20" },
  { id: "sarah", name: "Sarah", birthDate: "1984-03-15" },
  { id: "nathan", name: "Nathan", birthDate: "1982-08-22" },
];

// Tests ------------------------------------------------------------------

describe("findPrimeMoments — Toups Primes canonical case", () => {
  // The synthetic Toups family above is constructed so that within
  // [2025, 2090] there are exactly four prime moments, all instances of
  // the [0, 30, 32] constellation: (11,41,43), (29,59,61), (41,71,73),
  // (71,101,103). These are the well-known Toups Prime triples under 122.
  const result = findPrimeMoments(TOUPS_FAMILY, {
    from: utc(2025, 1, 1),
    through: utc(2090, 1, 1),
  });

  test("returns exactly one constellation", () => {
    expect(result).toHaveLength(1);
  });

  test("the constellation has shape [0, 30, 32]", () => {
    expect(result[0].offsets).toEqual([0, 30, 32]);
  });

  test("the constellation has exactly four moments", () => {
    expect(result[0].moments).toHaveLength(4);
  });

  test("moments are in chronological order with the expected ages", () => {
    const ages = result[0].moments.map((m) =>
      m.ages.map((a) => a.age).sort((a, b) => a - b),
    );
    expect(ages).toEqual([
      [11, 41, 43],
      [29, 59, 61],
      [41, 71, 73],
      [71, 101, 103],
    ]);
  });

  test("each moment spans Sep 20 of one year to Mar 14 of the next", () => {
    const ranges = result[0].moments.map((m) => [m.startDate, m.endDate]);
    expect(ranges).toEqual([
      ["2025-09-20", "2026-03-14"],
      ["2043-09-20", "2044-03-14"],
      ["2055-09-20", "2056-03-14"],
      ["2085-09-20", "2086-03-14"],
    ]);
  });

  test("each moment carries ages in the original family input order", () => {
    for (const m of result[0].moments) {
      expect(m.ages.map((a) => a.name)).toEqual(["Lyra", "Sarah", "Nathan"]);
    }
  });
});

describe("findPrimeMoments — single-member family", () => {
  // A single-member family always has offset pattern [0]. Within
  // [2020, 2030], a person born 2010-01-01 hits prime ages at 11, 13,
  // 17, and 19 — four moments, each a full calendar year.
  const result = findPrimeMoments(
    [{ id: "x", name: "X", birthDate: "2010-01-01" }],
    { from: utc(2020, 1, 1), through: utc(2030, 1, 1) },
  );

  test("returns one constellation with offsets [0]", () => {
    expect(result).toHaveLength(1);
    expect(result[0].offsets).toEqual([0]);
  });

  test("contains four moments with ages 11, 13, 17, 19", () => {
    const ages = result[0].moments.map((m) => m.ages[0].age);
    expect(ages).toEqual([11, 13, 17, 19]);
  });

  test("each moment spans the full calendar year of that prime age", () => {
    const ranges = result[0].moments.map((m) => [m.startDate, m.endDate]);
    expect(ranges).toEqual([
      ["2021-01-01", "2021-12-31"],
      ["2023-01-01", "2023-12-31"],
      ["2027-01-01", "2027-12-31"],
      ["2029-01-01", "2029-12-31"],
    ]);
  });
});

describe("findPrimeMoments — no shared moments", () => {
  // Two people 91 years apart. For both ages to be prime, we'd need
  // (p, p+91) all prime. 91 is odd, so p and p+91 have opposite parity;
  // one of them must be even and prime — meaning p = 2, but 2+91 = 93 is
  // 3·31, not prime. So zero moments.
  test("returns no constellations", () => {
    const result = findPrimeMoments(
      [
        { id: "a", name: "A", birthDate: "1934-01-01" },
        { id: "b", name: "B", birthDate: "2025-01-01" },
      ],
      { from: utc(2026, 1, 1), through: utc(2056, 1, 1) },
    );
    expect(result).toEqual([]);
  });
});

describe("findPrimeMoments — empty family", () => {
  test("returns no constellations", () => {
    expect(findPrimeMoments([])).toEqual([]);
  });
});

describe("findPrimeMoments — leap-day birthday", () => {
  // A person born on Feb 29 2000 reaches age 29 (prime) on the
  // canonical "birthday" boundary. JS Date treats Feb 29 in a non-leap
  // year as Mar 1, and so does the finder — internally consistent.
  // We just verify the algorithm produces the correct moment without
  // crashing on the leap-day input.
  const result = findPrimeMoments(
    [{ id: "leap", name: "Leap", birthDate: "2000-02-29" }],
    { from: utc(2029, 1, 1), through: utc(2030, 1, 1) },
  );

  test("returns the age-29 prime moment", () => {
    expect(result).toHaveLength(1);
    expect(result[0].offsets).toEqual([0]);
    expect(result[0].moments).toHaveLength(1);
    expect(result[0].moments[0].ages[0].age).toBe(29);
  });

  test("the moment runs from the rolled birthday to the search end", () => {
    const m = result[0].moments[0];
    // 2029 is non-leap; the algorithm rolls Feb 29 → Mar 1 consistently.
    // The next birthday is 2030-03-01 — past `through` — so the window
    // is clipped to `through` (which is inclusive).
    expect(m.startDate).toBe("2029-03-01");
    expect(m.endDate).toBe("2030-01-01");
  });
});

describe("findPrimeMoments — through < from", () => {
  test("returns no constellations", () => {
    const result = findPrimeMoments(TOUPS_FAMILY, {
      from: utc(2030, 1, 1),
      through: utc(2025, 1, 1),
    });
    expect(result).toEqual([]);
  });
});

describe("findPrimeMoments — maxLifespan caps reported moments", () => {
  // Same Toups family, but cap maxLifespan at 50. Only the first
  // instance (11, 41, 43) qualifies — every later instance contains an
  // age over 50.
  test("clips to instances under the cap", () => {
    const result = findPrimeMoments(TOUPS_FAMILY, {
      from: utc(2025, 1, 1),
      through: utc(2090, 1, 1),
      maxLifespan: 50,
    });
    expect(result).toHaveLength(1);
    expect(result[0].moments).toHaveLength(1);
    expect(result[0].moments[0].ages.map((a) => a.age).sort((a, b) => a - b))
      .toEqual([11, 41, 43]);
  });
});
