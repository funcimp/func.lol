import { describe, expect, test } from "bun:test";

import { findPrimeMoments } from "./primeMoments";
import type { Person } from "./types";

// Helpers ----------------------------------------------------------------

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

const REF_GROUP: Person[] = [
  { id: "eve", name: "Eve", birthDate: "2013-07-01" },
  { id: "alice", name: "Alice", birthDate: "1982-10-05" },
  { id: "bob", name: "Bob", birthDate: "1981-09-05" },
];

// Tests ------------------------------------------------------------------

describe("findPrimeMoments — Toups Primes canonical case", () => {
  // The synthetic reference group above is constructed so that within
  // [2024, 2090] there are exactly four prime moments, all instances of
  // the [0, 30, 32] constellation: (11,41,43), (29,59,61), (41,71,73),
  // (71,101,103). These are the well-known Toups Prime triples under 122.
  const result = findPrimeMoments(REF_GROUP, {
    from: utc(2024, 1, 1),
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

  test("each moment spans Sep 5 to Oct 4 of the same year", () => {
    const ranges = result[0].moments.map((m) => [m.startDate, m.endDate]);
    expect(ranges).toEqual([
      ["2024-09-05", "2024-10-04"],
      ["2042-09-05", "2042-10-04"],
      ["2054-09-05", "2054-10-04"],
      ["2084-09-05", "2084-10-04"],
    ]);
  });

  test("each moment carries ages in the original group input order", () => {
    for (const m of result[0].moments) {
      expect(m.ages.map((a) => a.name)).toEqual(["Eve", "Alice", "Bob"]);
    }
  });
});

describe("findPrimeMoments — single-person group", () => {
  // A single-person group always has offset pattern [0]. Within
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

describe("findPrimeMoments — empty group", () => {
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
    const result = findPrimeMoments(REF_GROUP, {
      from: utc(2030, 1, 1),
      through: utc(2025, 1, 1),
    });
    expect(result).toEqual([]);
  });
});

describe("findPrimeMoments — inadmissible constellations are filtered", () => {
  // A 2-person group where the only in-range all-prime window is
  // (2, 13), produced by the constellation [0, 11]. Since [0, 11]
  // covers both residues mod 2, it's inadmissible and gets filtered.
  // Result: empty.
  test("drops [0, 11] singleton (2, 13)", () => {
    // Person A born Mar 1 2000, Person B born Jun 1 2010.
    // Range is narrowed to the Mar–May 2013 window where A has turned
    // 13 but B is still 2 — ages (2, 13), offsets [0, 11], both prime
    // but inadmissible. The [0, 10] window (Jun 1 onward, ages 3 and
    // 13) is deliberately excluded from the range so the test isolates
    // the inadmissible moment.
    const result = findPrimeMoments(
      [
        { id: "a", name: "A", birthDate: "2000-03-01" },
        { id: "b", name: "B", birthDate: "2010-06-01" },
      ],
      { from: utc(2013, 3, 15), through: utc(2013, 5, 31) },
    );
    expect(result).toEqual([]);
  });

  // A 3-person group whose only in-range all-prime window is
  // (3, 5, 7), producing [0, 2, 4]. Inadmissible mod 3 — the
  // offsets cover all residues {0, 1, 2} mod 3. Filtered out.
  test("drops [0, 2, 4] singleton (3, 5, 7)", () => {
    // Three people aged 3, 5, 7 at the same moment.
    // Born 4 / 2 / 0 years before 2024-01-01 respectively, with
    // matching birth month/day so the window aligns.
    const result = findPrimeMoments(
      [
        { id: "a", name: "A", birthDate: "2020-06-01" },
        { id: "b", name: "B", birthDate: "2018-06-01" },
        { id: "c", name: "C", birthDate: "2016-06-01" },
      ],
      { from: utc(2023, 6, 1), through: utc(2024, 6, 1) },
    );
    expect(result).toEqual([]);
  });
});

describe("findPrimeMoments — maxLifespan caps reported moments", () => {
  // Same reference group, but cap maxLifespan at 50. Only the first
  // instance (11, 41, 43) qualifies — every later instance contains an
  // age over 50.
  test("clips to instances under the cap", () => {
    const result = findPrimeMoments(REF_GROUP, {
      from: utc(2024, 1, 1),
      through: utc(2090, 1, 1),
      maxLifespan: 50,
    });
    expect(result).toHaveLength(1);
    expect(result[0].moments).toHaveLength(1);
    expect(
      result[0].moments[0].ages.map((a) => a.age).sort((a, b) => a - b),
    ).toEqual([11, 41, 43]);
  });
});
