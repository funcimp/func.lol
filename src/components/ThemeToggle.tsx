"use client";

import { useEffect, useState } from "react";

import { parseTheme, type Theme, THEME_COOKIE } from "@/lib/theme";

function readCurrentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return parseTheme(
    document.documentElement.getAttribute("data-theme") ?? undefined,
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Deliberate hydration-safe pattern: defer DOM read until after mount so SSR and first client render agree.
    setTheme(readCurrentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  if (theme === null) {
    // Placeholder reserves the button's footprint so the crumb row
    // doesn't shift when the real glyph swaps in after hydration.
    return (
      <span
        aria-hidden="true"
        className="inline-block w-[1.2em] h-[1.2em] font-mono text-[14px]"
      />
    );
  }

  const isLight = theme === "light";
  const glyph = isLight ? "☾" : "☼";
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="font-mono text-[14px] leading-none text-ink opacity-70 hover:opacity-100 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
    >
      {glyph}
    </button>
  );
}
