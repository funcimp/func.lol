// Cross-platform-safe comparison for committed JSON snapshots of computed geometry.
//
// The geomWalls.json / scene.json snapshots hold trig-derived floats (sin, cos, sqrt),
// whose last bit differs between CPU architectures: the snapshot is generated on one
// machine and CI runs on another, so a byte-for-byte toEqual fails on values that agree
// to ~15 digits. This compares STRUCTURE exactly (arrays, object keys, integers,
// strings, booleans) and only allows numbers to differ within a tight tolerance, so a
// real drift (different tiles, counts, positions) still fails loudly while last-ULP
// platform noise does not.
//
// Returns the path of the first real difference, or null when the two match. Tests do
// `expect(firstDrift(committed, live)).toBeNull()`, which prints the offending path.

export function firstDrift(a: unknown, b: unknown, eps = 1e-9, path = "$"): string | null {
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return null;
    return Math.abs(a - b) <= eps ? null : `${path}: ${a} vs ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDrift(a[i], b[i], eps, `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as Record<string, unknown>).sort();
    const kb = Object.keys(b as Record<string, unknown>).sort();
    if (ka.join(",") !== kb.join(",")) return `${path}: keys {${ka}} vs {${kb}}`;
    for (const k of ka) {
      const d = firstDrift(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        eps,
        `${path}.${k}`,
      );
      if (d) return d;
    }
    return null;
  }
  return Object.is(a, b) ? null : `${path}: ${String(a)} vs ${String(b)}`;
}
