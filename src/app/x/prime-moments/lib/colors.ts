export const INSTANCE_COLORS = [
  "var(--color-moment-1)",
  "var(--color-moment-2)",
  "var(--color-moment-3)",
  "var(--color-moment-4)",
];

export function instanceColor(index: number): string {
  return INSTANCE_COLORS[index % INSTANCE_COLORS.length];
}
