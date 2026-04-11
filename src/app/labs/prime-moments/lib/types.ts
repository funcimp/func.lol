// Pure data types for the Prime Moments finder.
// No React, no DOM. Imported by both the lib and the React component.

export type Person = {
  id: string;        // unique within a group input — used as React key
  name: string;
  birthDate: string; // ISO YYYY-MM-DD
};

export type AgeAt = {
  name: string;
  age: number;
};

export type PrimeMoment = {
  startDate: string; // ISO YYYY-MM-DD, inclusive
  endDate: string;   // ISO YYYY-MM-DD, inclusive
  ages: AgeAt[];     // in group input order
};

// A constellation groups every PrimeMoment that shares the same offset shape
// (sorted ascending, normalized so the smallest offset is 0).
export type Constellation = {
  offsets: number[];
  moments: PrimeMoment[];
};

export type FindOptions = {
  // First date to consider. Defaults to today (UTC).
  from?: Date;
  // Last date to consider. Defaults to (oldestBirthYear + maxLifespan)-12-31.
  through?: Date;
  // Hard cap on age. Defaults to 122 (Jeanne Calment).
  maxLifespan?: number;
};
