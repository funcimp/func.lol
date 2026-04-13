// Shared theme plumbing for the root layout (which reads the cookie on
// the server) and the ThemeToggle client component (which writes it).
// Centralizes the default ("dark"), the cookie name, and the parse step
// so the two sites can't drift apart.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

/**
 * Narrow an arbitrary cookie value to a Theme. Unknown or missing values
 * default to "dark" — the design language's chosen initial state.
 */
export function parseTheme(value: string | undefined): Theme {
  return value === "light" ? "light" : "dark";
}
