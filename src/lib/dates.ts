// Shared date helpers. Kept intentionally small — any prime-moments-
// specific date logic stays in app/labs/prime-moments/lib/.

/**
 * Format an ISO YYYY-MM-DD string as "Mon D, YYYY" in en-US, reading
 * the date as UTC to avoid timezone drift in the display.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
