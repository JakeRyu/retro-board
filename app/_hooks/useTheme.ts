"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "retro-theme";

// Read the theme the inline bootstrap script (in app/layout.tsx) already
// resolved onto <html data-theme>. Falls back to "dark" (the original
// appearance) during SSR / before the attribute exists.
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private-mode / storage-disabled — theme still applies for this session,
    // it just won't be remembered on reload. Non-fatal.
  }
}

// Theme state synced to <html data-theme> + localStorage. SSR-safe: the first
// render returns "dark" to match the server markup, then a mount effect reads
// the real value the bootstrap script set, avoiding a hydration mismatch.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
