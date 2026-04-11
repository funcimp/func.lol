// Pure-function finder for prime moments.
//
// A prime moment is a maximal date range during which every member of a
// family simultaneously has a prime age. The finder walks the calendar
// from `from` to `through`, partitioning the range into windows at every
// member's birthday (because ages are constant inside each window), and
// emits the windows where every age is prime and within `maxLifespan`.
//
// Results are grouped by offset pattern: each Constellation collects all
// moments whose sorted ages share the same shape relative to the youngest.

import { isPrime } from "./primes";
import type {
  AgeAt,
  Constellation,
  FamilyMember,
  FindOptions,
  PrimeMoment,
} from "./types";

const DEFAULT_MAX_LIFESPAN = 122;

// All date math is done in UTC to avoid timezone drift. We only care about
// year/month/day, never about clock time.

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toUTCDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function ageAt(birth: Date, on: Date): number {
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayThisYear = new Date(
    Date.UTC(on.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()),
  );
  if (on < birthdayThisYear) age--;
  return age;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

// Sorted ascending, shifted so the smallest entry is 0.
function offsetPattern(ages: number[]): number[] {
  const sorted = [...ages].sort((a, b) => a - b);
  const base = sorted[0];
  return sorted.map((a) => a - base);
}

export function findPrimeMoments(
  family: FamilyMember[],
  opts: FindOptions = {},
): Constellation[] {
  if (family.length === 0) return [];

  const births = family.map((m) => ({
    name: m.name,
    birth: parseISODate(m.birthDate),
  }));

  const maxLifespan = opts.maxLifespan ?? DEFAULT_MAX_LIFESPAN;

  const fromUTC = opts.from ? toUTCDay(opts.from) : toUTCDay(new Date());

  const oldestBirthYear = Math.min(
    ...births.map((b) => b.birth.getUTCFullYear()),
  );
  const throughUTC = opts.through
    ? toUTCDay(opts.through)
    : new Date(Date.UTC(oldestBirthYear + maxLifespan, 11, 31));

  if (throughUTC < fromUTC) return [];

  // Build a single sorted list of boundaries spanning [from, through].
  // Inside any [boundary[i], boundary[i+1]) window, every member's age is
  // constant — that's the whole point of using birthdays as boundaries.
  // We deliberately do NOT split at year boundaries; a moment that runs
  // from September into March of the next year stays a single moment.
  const exclusiveEnd = addDays(throughUTC, 1);
  const startYear = fromUTC.getUTCFullYear();
  const endYear = throughUTC.getUTCFullYear();

  const boundarySet = new Set<number>();
  boundarySet.add(fromUTC.getTime());
  boundarySet.add(exclusiveEnd.getTime());

  for (const b of births) {
    for (let y = startYear; y <= endYear + 1; y++) {
      const birthday = new Date(
        Date.UTC(y, b.birth.getUTCMonth(), b.birth.getUTCDate()),
      );
      if (birthday >= fromUTC && birthday <= exclusiveEnd) {
        boundarySet.add(birthday.getTime());
      }
    }
  }

  const boundaries = [...boundarySet]
    .sort((a, b) => a - b)
    .map((t) => new Date(t));

  const moments: PrimeMoment[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const winStart = boundaries[i];
    const winEndExclusive = boundaries[i + 1];

    const clippedStart = winStart < fromUTC ? fromUTC : winStart;
    const dayBefore = addDays(winEndExclusive, -1);
    const clippedEnd = dayBefore > throughUTC ? throughUTC : dayBefore;

    if (clippedEnd < clippedStart) continue;

    // Ages are constant across the window, so any point inside it works.
    const ages: AgeAt[] = births.map((b) => ({
      name: b.name,
      age: ageAt(b.birth, clippedStart),
    }));

    if (ages.every((a) => a.age <= maxLifespan && isPrime(a.age))) {
      moments.push({
        startDate: toISODate(clippedStart),
        endDate: toISODate(clippedEnd),
        ages,
      });
    }
  }

  // Group by offset pattern.
  const groups = new Map<string, Constellation>();
  for (const m of moments) {
    const offsets = offsetPattern(m.ages.map((a) => a.age));
    const key = offsets.join(",");
    let g = groups.get(key);
    if (!g) {
      g = { offsets, moments: [] };
      groups.set(key, g);
    }
    g.moments.push(m);
  }

  // Most-frequent first; break ties by lexicographic offset string.
  return [...groups.values()].sort((a, b) => {
    if (b.moments.length !== a.moments.length) {
      return b.moments.length - a.moments.length;
    }
    return a.offsets.join(",").localeCompare(b.offsets.join(","));
  });
}
